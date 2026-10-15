var DETWIL_RECOVERY_ACTIONS = ['recoveryRequest', 'recoveryRequests', 'issuePasswordReset', 'completePasswordReset'];

function DETWIL_recoveryAccount_(email) {
  var user = DETWIL_findFirstByField('USERS', 'Email', email);
  var credential = user && DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', user.UserID);
  var start = user && user.StartDate ? new Date(user.StartDate).getTime() : -Infinity;
  var end = user && user.EndDate ? new Date(user.EndDate).getTime() : Infinity;
  if (!DETWIL_isPasswordLoginEnabled() || !user || DETWIL_bool(user.IsDeleted) || ['ACTIVE', 'PENDING'].indexOf(user.AccountStatus) < 0 || !DETWIL_bool(user.CanLogin) || !DETWIL_bool(user.PasswordLoginEnabled) || !(start <= Date.now() && end >= Date.now()) || !credential || DETWIL_bool(credential.IsDeleted) || credential.CredentialStatus !== 'ACTIVE' || DETWIL_normalizeEmail(credential.Email) !== email) return null;
  return { user: user, credential: credential };
}

function DETWIL_recoveryProtected_(user) {
  return user.PrimaryRole === 'SUPER_ADMIN' || DETWIL_memberRoles_(user.UserID).some(function(role) { return role.role === 'SUPER_ADMIN' && role.status === 'ACTIVE'; });
}

// Fingerprint the credential itself: two password changes within one second still invalidate the link.
function DETWIL_recoveryVersion_(credential) {
  return DETWIL_workHash_([credential.CredentialID, credential.PasswordHash, credential.PasswordSalt, credential.PasswordAlgorithm].join(':'));
}

function DETWIL_recoveryPending_(account) {
  var rows = DETWIL_readAll('PASSWORD_RESET_REQUESTS').filter(function(row) { return row.UserID === account.user.UserID && !DETWIL_bool(row.IsDeleted); });
  var outstanding = rows.filter(function(row) { return DETWIL_normalizeEmail(row.Email) === DETWIL_normalizeEmail(account.user.Email) && (row.Status === 'PENDING' || (row.Status === 'ISSUED' && new Date(row.ExpiresAt).getTime() > Date.now() && row.CredentialVersionHash === DETWIL_recoveryVersion_(account.credential))); })[0];
  if (outstanding) return outstanding;
  var now = DETWIL_nowIso();
  var request = rows[0] || { ResetRequestID: DETWIL_uuid(), UserID: account.user.UserID, IsDeleted: 'FALSE' };
  Object.assign(request, { Email: account.user.Email, Status: 'PENDING', RequestedAt: now, TokenHash: '', ExpiresAt: '', ApprovedAt: '', ApprovedBy: '', CredentialID: '', CredentialVersionHash: '', UsedAt: '', UpdatedAt: now });
  DETWIL_workWrite_('PASSWORD_RESET_REQUESTS', request, 'ResetRequestID');
  return request;
}

function DETWIL_issueRecovery_(request, actor, editorOwner) {
  var account = request && DETWIL_recoveryAccount_(DETWIL_normalizeEmail(request.Email));
  if (!request || !account || account.user.UserID !== request.UserID || ['PENDING', 'ISSUED'].indexOf(request.Status) < 0) DETWIL_workError_('INVALID_STATE', 'คำขอเปลี่ยนแล้วหรือบัญชีไม่พร้อมใช้งาน กรุณาโหลดใหม่');
  if (DETWIL_recoveryProtected_(account.user) && (!editorOwner || actor.UserID !== account.user.UserID)) DETWIL_workError_('FORBIDDEN', 'บัญชีผู้ดูแลสูงสุดต้องกู้ผ่าน Google Apps Script ของเจ้าของบัญชีเท่านั้น');
  var token = DETWIL_uuid() + DETWIL_uuid();
  var now = DETWIL_nowIso();
  // Invalidate earlier outstanding requests before issuing a replacement.
  DETWIL_readAll('PASSWORD_RESET_REQUESTS').filter(function(row) { return row.UserID === request.UserID && row.ResetRequestID !== request.ResetRequestID && !DETWIL_bool(row.IsDeleted) && ['PENDING', 'ISSUED'].indexOf(row.Status) >= 0; }).forEach(function(row) {
    row.Status = 'CANCELLED'; row.TokenHash = ''; row.UpdatedAt = now;
    DETWIL_workWrite_('PASSWORD_RESET_REQUESTS', row, 'ResetRequestID');
  });
  Object.assign(request, { Status: 'ISSUED', TokenHash: DETWIL_workHash_(token), ExpiresAt: new Date(Date.now() + 900000).toISOString(), ApprovedAt: now, ApprovedBy: actor.UserID, CredentialID: account.credential.CredentialID, CredentialVersionHash: DETWIL_recoveryVersion_(account.credential), UsedAt: '', UpdatedAt: now });
  DETWIL_workWrite_('PASSWORD_RESET_REQUESTS', request, 'ResetRequestID');
  DETWIL_memberAudit_(actor, 'ISSUE_PASSWORD_RESET', request.UserID, 'Identity verified by administrator; one-time link expires in 15 minutes.');
  return { resetUrl: 'https://detwil-kru.vercel.app/reset-password?token=' + encodeURIComponent(token), expiresAt: request.ExpiresAt, email: account.user.Email };
}

function DETWIL_completeRecovery_(payload) {
  var token = typeof payload.token === 'string' ? payload.token : '';
  if (!/^[a-f0-9-]{72}$/i.test(token)) DETWIL_workError_('INVALID_STATE', 'ลิงก์ตั้งรหัสผ่านไม่ถูกต้อง ใช้แล้ว หรือหมดอายุ กรุณาขอลิงก์ใหม่');
  var request = DETWIL_findFirstByField('PASSWORD_RESET_REQUESTS', 'TokenHash', DETWIL_workHash_(token));
  var account = DETWIL_recoveryAccount_(DETWIL_normalizeEmail(payload.email));
  if (!request || request.Status !== 'ISSUED' || !(new Date(request.ExpiresAt).getTime() > Date.now()) || !account || account.user.UserID !== request.UserID || DETWIL_normalizeEmail(request.Email) !== DETWIL_normalizeEmail(payload.email) || request.CredentialID !== account.credential.CredentialID || request.CredentialVersionHash !== DETWIL_recoveryVersion_(account.credential)) DETWIL_workError_('INVALID_STATE', 'ลิงก์ตั้งรหัสผ่านหรืออีเมลไม่ถูกต้อง ใช้แล้ว หรือหมดอายุ กรุณาขอลิงก์ใหม่');
  var material = DETWIL_passwordMaterial_(payload);
  var credential = account.credential;
  var salt = DETWIL_uuid() + DETWIL_uuid();
  var hash = DETWIL_hashPassword_(material.value, salt, material.algorithm);
  var now = DETWIL_nowIso();
  // Sheets has no transactions. Revoke sessions first; the credential fingerprint prevents replay if a later write fails.
  DETWIL_readAll('AUTH_SESSIONS').filter(function(session) { return session.UserID === request.UserID && !DETWIL_bool(session.IsDeleted); }).forEach(function(session) {
    session.IsDeleted = 'TRUE'; DETWIL_workWrite_('AUTH_SESSIONS', session, 'SessionID');
  });
  Object.assign(credential, { PasswordHash: hash, PasswordSalt: salt, PasswordAlgorithm: material.algorithm, PasswordUpdatedAt: now, MustChangePassword: 'FALSE', FailedLoginCount: 0, LockedUntil: '', LastFailedLoginAt: '', LastPasswordResetAt: now, ResetBy: request.ApprovedBy, UpdatedAt: now, UpdatedBy: account.user.UserID });
  DETWIL_workWrite_('AUTH_CREDENTIALS', credential, 'CredentialID');
  DETWIL_readAll('PASSWORD_RESET_REQUESTS').filter(function(row) { return row.UserID === request.UserID && !DETWIL_bool(row.IsDeleted) && ['PENDING', 'ISSUED'].indexOf(row.Status) >= 0; }).forEach(function(row) {
    row.Status = row.ResetRequestID === request.ResetRequestID ? 'USED' : 'CANCELLED';
    row.TokenHash = ''; row.UpdatedAt = now;
    if (row.Status === 'USED') row.UsedAt = now;
    DETWIL_workWrite_('PASSWORD_RESET_REQUESTS', row, 'ResetRequestID');
  });
  DETWIL_memberAudit_(account.user, 'COMPLETE_PASSWORD_RESET', request.UserID, 'Member chose a new password; all sessions revoked.');
  return { changed: true };
}

function DETWIL_recoveryApi_(action, payload, token) {
  var lock;
  try {
    payload = payload || {};
    lock = LockService.getScriptLock(); lock.waitLock(30000);
    if (action === 'recoveryRequest') {
      var email = DETWIL_normalizeEmail(payload.email);
      if (email.length > 254 || !DETWIL_validateEmail(email)) DETWIL_workError_('VALIDATION', 'กรุณากรอกอีเมลให้ถูกต้อง');
      var account = !String(payload.website || '') && DETWIL_recoveryAccount_(email);
      if (account) DETWIL_recoveryPending_(account);
      // Do not reveal account existence or change credentials/sessions on a public request.
      return DETWIL_jsonSuccess({ received: true });
    }
    if (action === 'completePasswordReset') return DETWIL_jsonSuccess(DETWIL_completeRecovery_(payload));
    var actor = DETWIL_sessionUser_(token, false, false);
    if (actor.PrimaryRole !== 'SUPER_ADMIN') DETWIL_workError_('FORBIDDEN', 'เฉพาะผู้ดูแลระบบที่ใช้บทบาท Super Admin');
    if (action === 'recoveryRequests') {
      var users = DETWIL_readAll('USERS');
      var roles = DETWIL_readAll('USER_ROLES');
      return DETWIL_jsonSuccess({ items: DETWIL_readAll('PASSWORD_RESET_REQUESTS').filter(function(row) { return !DETWIL_bool(row.IsDeleted) && ['PENDING', 'ISSUED'].indexOf(row.Status) >= 0; }).map(function(row) {
        var user = users.filter(function(item) { return item.UserID === row.UserID && !DETWIL_bool(item.IsDeleted); })[0];
        return { id: row.ResetRequestID, email: row.Email, displayName: user ? user.DisplayName : '', status: row.Status, requestedAt: row.RequestedAt, expiresAt: row.ExpiresAt, requiresEditor: Boolean(user && (user.PrimaryRole === 'SUPER_ADMIN' || roles.some(function(role) { return role.UserID === user.UserID && role.RoleCode === 'SUPER_ADMIN' && role.Status === 'ACTIVE' && !DETWIL_bool(role.IsDeleted); }))) };
      }).reverse() });
    }
    if (action === 'issuePasswordReset') {
      if (payload.identityVerified !== true) DETWIL_workError_('VALIDATION', 'กรุณายืนยันตัวตนของเจ้าของบัญชีก่อนออกลิงก์');
      return DETWIL_jsonSuccess(DETWIL_issueRecovery_(DETWIL_findFirstByField('PASSWORD_RESET_REQUESTS', 'ResetRequestID', payload.requestId), actor, false));
    }
    DETWIL_workError_('UNKNOWN_ACTION', 'ไม่พบคำสั่งกู้บัญชี');
  } catch (error) { return DETWIL_jsonError(error.code || 'UNAVAILABLE', error.code ? error.message : 'ระบบกู้บัญชีไม่พร้อมใช้งาน กรุณาลองใหม่หรือติดต่อผู้ดูแล'); }
  finally { if (lock) lock.releaseLock(); }
}

// Editor-only bootstrap: check every existing header before creating the new table.
function DETWIL_preparePasswordRecovery() {
  DETWIL_owner_();
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var book = DETWIL_getSpreadsheet();
    var plan = DETWIL_registrationSchemaPlan_(book);
    var item = plan.filter(function(row) { return row.name === 'PASSWORD_RESET_REQUESTS'; })[0];
    if (item.operation === 'CREATE') DETWIL_ensureSheet(item.name);
    var report = { ready: true, table: item.name, created: item.operation === 'CREATE', tableCount: plan.length };
    console.log(JSON.stringify(report));
    return report;
  } finally { lock.releaseLock(); }
}

// Private fallback when the app administrator cannot sign in. Set the exact target in Script Properties first.
function DETWIL_issueEditorPasswordReset() {
  var owner = DETWIL_owner_();
  var email = DETWIL_normalizeEmail(DETWIL_getScriptProperties_().getProperty('DETWIL_RECOVERY_TARGET_EMAIL'));
  if (!email) DETWIL_workError_('VALIDATION', 'ตั้ง Script Property DETWIL_RECOVERY_TARGET_EMAIL เป็นอีเมลที่ยืนยันตัวตนแล้วก่อนรัน');
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    var account = DETWIL_recoveryAccount_(email);
    if (!account) DETWIL_workError_('INVALID_STATE', 'บัญชีนี้ยังไม่มีรหัสผ่านหรือไม่ได้เปิดใช้งาน หากเป็นผู้ดูแลใหม่ให้รัน DETWIL_prepareWorkSystem');
    var result = DETWIL_issueRecovery_(DETWIL_recoveryPending_(account), owner, true);
    DETWIL_getScriptProperties_().deleteProperty('DETWIL_RECOVERY_TARGET_EMAIL');
    console.log('ลิงก์ส่วนตัวสำหรับเจ้าของบัญชี ' + result.email + ' ใช้ได้ครั้งเดียวภายใน 15 นาที: ' + result.resetUrl);
    return result;
  } finally { lock.releaseLock(); }
}
