var DETWIL_MEMBER_ROLES = ['TEACHER', 'SCHOOL_ADMIN', 'SUPERVISOR', 'AREA_ADMIN'];
var DETWIL_MEMBER_ACTIONS = ['registrationOptions', 'register', 'switchRole', 'requestRoles', 'roleDecision', 'assignRoles', 'resetMemberPassword'];

function DETWIL_prepareMembershipSystem() {
  DETWIL_owner_();
  var sheet = DETWIL_getSheet('AUTH_SESSIONS');
  var headers = DETWIL_getHeaders('AUTH_SESSIONS');
  var expected = DETWIL.SHEET_SCHEMAS.AUTH_SESSIONS;
  if (JSON.stringify(headers) !== JSON.stringify(expected)) {
    if (JSON.stringify(headers) !== JSON.stringify(expected.slice(0, -1))) DETWIL_workError_('SCHEMA_MISMATCH', 'หัวตาราง session ไม่ตรงกัน จึงหยุดโดยไม่แก้ทับข้อมูล');
    if (sheet.getMaxColumns() < expected.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), expected.length - sheet.getMaxColumns());
    sheet.getRange(1, expected.length).setValue('ActiveRoleID').setFontWeight('bold');
  }
  console.log('เพิ่มคอลัมน์ ActiveRoleID แล้ว ข้อมูล session และบัญชีเดิมยังอยู่ครบ');
  return { ok: true };
}

// Editor-only migration. Never enables reviewer/admin roles or suspended accounts.
function DETWIL_prepareOpenMembership() {
  var owner = DETWIL_owner_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var report = DETWIL_migrateOpenMembership_(owner);
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally { lock.releaseLock(); }
}

function DETWIL_migrateOpenMembership_(owner) {
  var roles = DETWIL_readAll('USER_ROLES');
  var schools = DETWIL_readAll('SCHOOLS');
  var now = DETWIL_nowIso();
  var report = { accountsActivated: 0, teacherRolesActivated: 0, unapprovedWorksUnpublished: 0 };
  DETWIL_readAll('USERS').filter(function(user) {
    return user.CreatedBy === 'SELF_REGISTRATION' && !DETWIL_bool(user.IsDeleted) && ['ACTIVE', 'PENDING'].indexOf(user.AccountStatus) >= 0 && DETWIL_bool(user.CanLogin) && DETWIL_bool(user.PasswordLoginEnabled) && (!user.StartDate || new Date(user.StartDate).getTime() <= Date.now()) && (!user.EndDate || new Date(user.EndDate).getTime() >= Date.now());
  }).forEach(function(user) {
    var credential = DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', user.UserID);
    if (!credential || credential.CredentialStatus !== 'ACTIVE') return;
    var changed = false;
    roles.filter(function(role) {
      return role.UserID === user.UserID && role.RoleCode === 'TEACHER' && role.ScopeType === 'SCHOOL' && role.Status === 'PENDING' && !DETWIL_bool(role.IsDeleted) && schools.some(function(school) { return school.SchoolID === role.ScopeID && school.Status === 'ACTIVE' && !DETWIL_bool(school.IsDeleted); }) && (!role.StartDate || new Date(role.StartDate).getTime() <= Date.now()) && (!role.EndDate || new Date(role.EndDate).getTime() >= Date.now());
    }).forEach(function(role) {
      role.Status = 'ACTIVE'; role.UpdatedAt = now; role.UpdatedBy = owner.UserID;
      DETWIL_workWrite_('USER_ROLES', role, 'UserRoleID');
      report.teacherRolesActivated += 1; changed = true;
    });
    var teacher = DETWIL_memberRoles_(user.UserID, roles, schools).filter(function(role) { return role.role === 'TEACHER' && role.usable; })[0];
    if (user.AccountStatus === 'PENDING') { user.AccountStatus = 'ACTIVE'; report.accountsActivated += 1; changed = true; }
    if (teacher && user.PrimaryRole === 'PUBLIC_VISITOR') { user.PrimaryRole = 'TEACHER'; user.SchoolID = teacher.schoolId; changed = true; }
    if (changed) {
      user.UpdatedAt = now; user.UpdatedBy = owner.UserID;
      DETWIL_workWrite_('USERS', user, 'UserID');
      DETWIL_memberAudit_(owner, 'OPEN_MEMBERSHIP_MIGRATION', user.UserID, 'Basic membership only; privileged grants unchanged.');
    }
  });
  var approvals = DETWIL_approvalIndex_(DETWIL_readAll('WORKFLOW_LOG'));
  DETWIL_readAll('WORKS').filter(function(work) {
    return !DETWIL_bool(work.IsDeleted) && DETWIL_bool(work.IsPublic) && approvals[work.WorkID + ':' + work.PublishedVersionID] !== 'DISTRICT_APPROVED';
  }).forEach(function(work) {
    work.IsPublic = 'FALSE'; work.UpdatedAt = now;
    DETWIL_workWrite_('WORKS', work, 'WorkID');
    DETWIL_workLog_(work, owner, 'UNPUBLISH_UNAPPROVED', work.ApprovalStatus, 'School and district approval required before public publication.');
    report.unapprovedWorksUnpublished += 1;
  });
  return report;
}

function DETWIL_memberRoles_(userId, allRoles, allSchools) {
  var schools = allSchools || DETWIL_readAll('SCHOOLS');
  return (allRoles || DETWIL_readAll('USER_ROLES')).filter(function(r) { return r.UserID === userId && !DETWIL_bool(r.IsDeleted); }).map(function(r) {
    var school = r.ScopeType === 'SCHOOL' && schools.filter(function(s) { return s.SchoolID === r.ScopeID && !DETWIL_bool(s.IsDeleted); })[0];
    var start = r.StartDate ? new Date(r.StartDate).getTime() : -Infinity;
    var end = r.EndDate ? new Date(r.EndDate).getTime() : Infinity;
    var validScope = r.ScopeType === 'SCHOOL' ? ['TEACHER', 'SCHOOL_ADMIN'].indexOf(r.RoleCode) >= 0 && school && school.Status === 'ACTIVE' : r.ScopeType === 'GLOBAL' && r.ScopeID === 'DETWIL' && ['SUPER_ADMIN', 'SUPERVISOR', 'AREA_ADMIN'].indexOf(r.RoleCode) >= 0;
    var usable = r.Status === 'ACTIVE' && Boolean(validScope) && start <= Date.now() && end >= Date.now();
    return { id: r.UserRoleID, role: r.RoleCode, scopeType: r.ScopeType, schoolId: school ? school.SchoolID : '', schoolName: school ? school.SchoolName : '', status: r.Status, usable: usable, startDate: r.StartDate || '', endDate: r.EndDate || '' };
  });
}

function DETWIL_memberContext_(user, session) {
  var roles = DETWIL_memberRoles_(user.UserID);
  var role;
  if (session.ActiveRoleID) role = roles.filter(function(r) { return r.id === session.ActiveRoleID && r.usable; })[0];
  else role = roles.filter(function(r) { return r.usable && r.role === user.PrimaryRole && (!r.schoolId || r.schoolId === user.SchoolID); })[0] || roles.filter(function(r) { return r.usable; })[0];
  user._roles = roles; user._activeRoleId = role ? role.id : '';
  user._sessionId = session.SessionID;
  user.PrimaryRole = role ? role.role : 'PUBLIC_VISITOR';
  user.SchoolID = role && role.scopeType === 'SCHOOL' ? role.schoolId : '';
  return user;
}

function DETWIL_memberIdentity_(user, roles) {
  return { userId: user.UserID, email: user.Email, displayName: user.DisplayName, role: user.PrimaryRole, schoolId: user.SchoolID, mustChangePassword: Boolean(user.mustChangePassword), accountStatus: user.AccountStatus, activeRoleId: user._activeRoleId || '', roles: roles || user._roles || DETWIL_memberRoles_(user.UserID) };
}

function DETWIL_memberAudit_(actor, action, targetId, details) {
  DETWIL_workWrite_('AUDIT_LOG', { AuditID: DETWIL_uuid(), ActorUserID: actor.UserID, ActorEmail: actor.Email, ActorRole: actor.PrimaryRole, Action: action, EntityType: 'MEMBERSHIP', EntityID: targetId, Result: 'SUCCESS', Message: details || '', CreatedAt: DETWIL_nowIso() });
}

function DETWIL_registrationOptions_() {
  return { schools: DETWIL_readAll('SCHOOLS').filter(function(s) { return s.Status === 'ACTIVE' && !DETWIL_bool(s.IsDeleted); }).map(function(s) { return { id: s.SchoolID, name: s.SchoolName }; }), roles: DETWIL_MEMBER_ROLES, approvalRequired: false, privilegedRolesRequireApproval: ['SCHOOL_ADMIN', 'SUPERVISOR', 'AREA_ADMIN'] };
}

function DETWIL_passwordMaterial_(payload) {
  if (typeof payload.passwordProof !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(payload.passwordProof)) DETWIL_workError_('VALIDATION', 'กรุณาตั้งรหัสผ่านผ่านหน้าเว็บ DETWIL');
  return { value: payload.passwordProof, algorithm: 'SCRYPT_SHA256_V1' };
}

function DETWIL_memberCredential_(user, material, mustChange, actorId) {
  var salt = DETWIL_uuid() + DETWIL_uuid();
  return { CredentialID: DETWIL_uuid(), UserID: user.UserID, Email: user.Email, PasswordSalt: salt, PasswordHash: DETWIL_hashPassword_(material.value, salt, material.algorithm), PasswordAlgorithm: material.algorithm, CredentialStatus: 'ACTIVE', MustChangePassword: mustChange ? 'TRUE' : 'FALSE', FailedLoginCount: 0, PasswordUpdatedAt: DETWIL_nowIso(), CreatedAt: DETWIL_nowIso(), CreatedBy: actorId, IsDeleted: 'FALSE' };
}

function DETWIL_requestedRoles_(requests) {
  if (!Array.isArray(requests) || requests.length > 8) DETWIL_workError_('VALIDATION', 'เลือกบทบาทได้ไม่เกิน 8 รายการต่อครั้ง');
  var seen = {};
  return requests.map(function(r) {
    if (!r || DETWIL_MEMBER_ROLES.indexOf(r.role) < 0) DETWIL_workError_('FORBIDDEN', 'ไม่สามารถสมัครบทบาทนี้ได้');
    var scoped = ['TEACHER', 'SCHOOL_ADMIN'].indexOf(r.role) >= 0;
    var school = scoped && DETWIL_findFirstByField('SCHOOLS', 'SchoolID', String(r.schoolId || ''));
    if (scoped && (!school || school.Status !== 'ACTIVE')) DETWIL_workError_('VALIDATION', 'กรุณาเลือกโรงเรียนที่เปิดใช้งาน');
    var request = { RoleCode: r.role, ScopeType: scoped ? 'SCHOOL' : 'GLOBAL', ScopeID: scoped ? school.SchoolID : 'DETWIL' };
    var key = request.RoleCode + ':' + request.ScopeID;
    if (seen[key]) DETWIL_workError_('VALIDATION', 'มีบทบาทซ้ำในโรงเรียนเดียวกัน');
    seen[key] = true; return request;
  });
}

function DETWIL_addRoleRequests_(target, requests, actor, approve) {
  var existing = DETWIL_readAll('USER_ROLES').filter(function(r) { return r.UserID === target.UserID && !DETWIL_bool(r.IsDeleted); });
  if (approve === 'SELF_SERVICE' && requests.some(function(request) {
    return request.RoleCode === 'TEACHER' && existing.some(function(r) { return r.RoleCode === request.RoleCode && r.ScopeType === request.ScopeType && r.ScopeID === request.ScopeID && ['REVOKED', 'REJECTED'].indexOf(r.Status) >= 0; });
  })) DETWIL_workError_('FORBIDDEN', 'สิทธิ์ครูนี้ถูกระงับหรือปฏิเสธ กรุณาติดต่อผู้ดูแล');
  var currentCount = existing.filter(function(r) { return ['PENDING', 'ACTIVE'].indexOf(r.Status) >= 0; }).length;
  var additional = requests.filter(function(request) { return !existing.some(function(r) { return r.RoleCode === request.RoleCode && r.ScopeType === request.ScopeType && r.ScopeID === request.ScopeID && ['PENDING', 'ACTIVE'].indexOf(r.Status) >= 0; }); }).length;
  if (currentCount + additional > 16) DETWIL_workError_('VALIDATION', 'บัญชีนี้มีบทบาทหรือคำขอมากเกินกำหนด');
  requests.forEach(function(request) {
    var activate = approve === true || (approve === 'SELF_SERVICE' && request.RoleCode === 'TEACHER');
    var previous = existing.filter(function(r) { return r.RoleCode === request.RoleCode && r.ScopeType === request.ScopeType && r.ScopeID === request.ScopeID; })[0];
    if (previous && (previous.Status === 'ACTIVE' || (previous.Status === 'PENDING' && !activate))) return;
    var role = previous || { UserRoleID: DETWIL_uuid(), UserID: target.UserID, CreatedAt: DETWIL_nowIso(), CreatedBy: actor.UserID, IsDeleted: 'FALSE' };
    Object.assign(role, request, { Status: activate ? 'ACTIVE' : 'PENDING', StartDate: '', EndDate: '', UpdatedAt: DETWIL_nowIso(), UpdatedBy: actor.UserID });
    DETWIL_workWrite_('USER_ROLES', role, 'UserRoleID');
    DETWIL_memberAudit_(actor, activate ? 'GRANT_ROLE' : 'REQUEST_ROLE', role.UserRoleID, request.RoleCode + ':' + request.ScopeID);
  });
}

function DETWIL_activateMember_(target, role) {
  if (target.AccountStatus === 'PENDING') target.AccountStatus = 'ACTIVE';
  if (target.PrimaryRole === 'PUBLIC_VISITOR') { target.PrimaryRole = role.RoleCode; target.SchoolID = role.ScopeType === 'SCHOOL' ? role.ScopeID : ''; }
  target.UpdatedAt = DETWIL_nowIso();
  DETWIL_workWrite_('USERS', target, 'UserID');
}

function DETWIL_register_(payload) {
  var email = DETWIL_normalizeEmail(payload.email);
  if (!DETWIL_isPasswordLoginEnabled() || String(payload.website || '')) DETWIL_workError_('VALIDATION', 'ไม่สามารถสมัครสมาชิกได้');
  if (email.length > 254 || !DETWIL_validateEmail(email)) DETWIL_workError_('VALIDATION', 'อีเมลไม่ถูกต้อง');
  if (DETWIL_findFirstByField('USERS', 'Email', email)) DETWIL_workError_('ACCOUNT_EXISTS', 'อีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบบัญชีเดิม หากยังไม่มีรหัสผ่านให้ติดต่อผู้ดูแล');
  var requests = DETWIL_requestedRoles_(payload.roles);
  var teacher = requests.filter(function(r) { return r.RoleCode === 'TEACHER'; })[0];
  if (!teacher) DETWIL_workError_('VALIDATION', 'กรุณาเลือกบทบาทครู / ผู้จัดทำผลงานและสถานศึกษา เพื่อใช้งานสมาชิกทันที');
  var user = { UserID: DETWIL_uuid(), Email: email, DisplayName: DETWIL_workText_(payload.displayName, 150, true), SchoolID: teacher.ScopeID, PrimaryRole: 'TEACHER', AccountStatus: 'ACTIVE', CanLogin: 'TRUE', PasswordLoginEnabled: 'TRUE', AuthMode: 'PASSWORD', CreatedAt: DETWIL_nowIso(), CreatedBy: 'SELF_REGISTRATION', IsDeleted: 'FALSE' };
  var credential = DETWIL_memberCredential_(user, DETWIL_passwordMaterial_(payload), false, user.UserID);
  DETWIL_workWrite_('AUTH_CREDENTIALS', credential);
  DETWIL_workWrite_('USERS', user);
  DETWIL_addRoleRequests_(user, requests, user, 'SELF_SERVICE');
  DETWIL_memberAudit_(user, 'REGISTER', user.UserID, 'Teacher access active immediately; reviewer/admin roles require verification; no email sent.');
  return { registered: true, accountStatus: 'ACTIVE' };
}

function DETWIL_memberApi_(action, payload, token) {
  var lock;
  try {
    payload = payload || {};
    if (action === 'registrationOptions') return DETWIL_jsonSuccess(DETWIL_registrationOptions_());
    if (action === 'register') {
      lock = LockService.getScriptLock(); lock.waitLock(30000);
      return DETWIL_jsonSuccess(DETWIL_register_(payload));
    }
    if (!token) DETWIL_workError_('UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
    var actor;
    lock = LockService.getScriptLock(); lock.waitLock(30000);
    // Re-read grants after obtaining the mutation lock so a concurrent revocation takes effect.
    actor = DETWIL_sessionUser_(token, false, true);
    if (action === 'switchRole') {
      var role = actor._roles.filter(function(r) { return r.id === payload.roleId && r.usable; })[0];
      if (!role || actor.AccountStatus !== 'ACTIVE') DETWIL_workError_('FORBIDDEN', 'บทบาทนี้ยังไม่ได้รับอนุมัติหรือหมดอายุ');
      var session = DETWIL_findFirstByField('AUTH_SESSIONS', 'SessionID', actor._sessionId);
      session.ActiveRoleID = role.id;
      DETWIL_workWrite_('AUTH_SESSIONS', session, 'SessionID');
      return DETWIL_jsonSuccess(DETWIL_identity_(DETWIL_memberContext_(DETWIL_findFirstByField('USERS', 'UserID', actor.UserID), session)));
    }
    if (action === 'requestRoles') {
      DETWIL_addRoleRequests_(actor, DETWIL_requestedRoles_(payload.roles), actor, 'SELF_SERVICE');
      var usableTeacher = DETWIL_memberRoles_(actor.UserID).filter(function(r) { return r.role === 'TEACHER' && r.usable; })[0];
      if (usableTeacher) DETWIL_activateMember_(DETWIL_findFirstByField('USERS', 'UserID', actor.UserID), { RoleCode: 'TEACHER', ScopeType: 'SCHOOL', ScopeID: usableTeacher.schoolId });
      return DETWIL_jsonSuccess(DETWIL_identity_(DETWIL_sessionUser_(token, false, true)));
    }
    if (actor.PrimaryRole !== 'SUPER_ADMIN') DETWIL_workError_('FORBIDDEN', 'เฉพาะผู้ดูแลระบบที่ใช้บทบาท Super Admin');
    if (action === 'roleDecision') {
      var grant = DETWIL_findFirstByField('USER_ROLES', 'UserRoleID', payload.roleId);
      if (!grant || grant.RoleCode === 'SUPER_ADMIN') DETWIL_workError_('FORBIDDEN', 'ไม่สามารถแก้สิทธิ์นี้ผ่านหน้าสมัครสมาชิก');
      var decisions = { APPROVE: 'ACTIVE', REJECT: 'REJECTED', REVOKE: 'REVOKED' };
      if (!decisions[payload.decision] || (payload.decision === 'REVOKE' ? grant.Status !== 'ACTIVE' : grant.Status !== 'PENDING')) DETWIL_workError_('INVALID_STATE', 'สถานะคำขอเปลี่ยนแล้ว กรุณาโหลดใหม่');
      var target = DETWIL_findFirstByField('USERS', 'UserID', grant.UserID);
      if (!target || ['ACTIVE', 'PENDING'].indexOf(target.AccountStatus) < 0) DETWIL_workError_('VALIDATION', 'บัญชีนี้ถูกปิดใช้งาน');
      if (payload.decision === 'APPROVE') {
        DETWIL_requestedRoles_([{ role: grant.RoleCode, schoolId: grant.ScopeID }]);
        DETWIL_activateMember_(target, grant);
      }
      grant.Status = decisions[payload.decision]; grant.UpdatedAt = DETWIL_nowIso(); grant.UpdatedBy = actor.UserID;
      DETWIL_workWrite_('USER_ROLES', grant, 'UserRoleID');
      DETWIL_memberAudit_(actor, 'ROLE_' + payload.decision, grant.UserRoleID, grant.RoleCode + ':' + grant.ScopeID);
      return DETWIL_jsonSuccess({ updated: true });
    }
    if (action === 'assignRoles') {
      var member = DETWIL_findFirstByField('USERS', 'UserID', payload.userId);
      if (!member || ['ACTIVE', 'PENDING'].indexOf(member.AccountStatus) < 0) DETWIL_workError_('VALIDATION', 'ไม่พบสมาชิกที่เปิดใช้งาน');
      var requested = DETWIL_requestedRoles_(payload.roles);
      if (!requested.length) DETWIL_workError_('VALIDATION', 'กรุณาเลือกบทบาท');
      DETWIL_addRoleRequests_(member, requested, actor, true);
      DETWIL_activateMember_(member, requested[0]);
      return DETWIL_jsonSuccess({ updated: true });
    }
    if (action === 'resetMemberPassword') {
      var account = DETWIL_findFirstByField('USERS', 'UserID', payload.userId);
      if (!account || account.PrimaryRole === 'SUPER_ADMIN' || DETWIL_memberRoles_(account.UserID).some(function(r) { return r.role === 'SUPER_ADMIN' && r.status === 'ACTIVE'; }) || account.Email !== DETWIL_normalizeEmail(payload.email)) DETWIL_workError_('FORBIDDEN', 'ไม่สามารถตั้งรหัสชั่วคราวให้บัญชีนี้ได้');
      var cred = DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', account.UserID);
      var replacement = DETWIL_memberCredential_(account, DETWIL_passwordMaterial_(payload), true, actor.UserID);
      if (cred) replacement.CredentialID = cred.CredentialID;
      replacement.LastPasswordResetAt = DETWIL_nowIso(); replacement.ResetBy = actor.UserID;
      DETWIL_workWrite_('AUTH_CREDENTIALS', replacement, 'CredentialID');
      DETWIL_readAll('AUTH_SESSIONS').filter(function(s) { return s.UserID === account.UserID; }).forEach(function(s) { s.IsDeleted = 'TRUE'; DETWIL_workWrite_('AUTH_SESSIONS', s, 'SessionID'); });
      DETWIL_memberAudit_(actor, 'RESET_PASSWORD', account.UserID, 'Temporary password; all sessions revoked.');
      return DETWIL_jsonSuccess({ updated: true });
    }
    DETWIL_workError_('UNKNOWN_ACTION', 'ไม่พบคำสั่งสมาชิก');
  } catch (error) { return DETWIL_jsonError(error.code || 'UNAVAILABLE', error.code ? error.message : 'ไม่สามารถดำเนินการสมาชิกได้ กรุณาลองใหม่'); }
  finally { if (lock) lock.releaseLock(); }
}
