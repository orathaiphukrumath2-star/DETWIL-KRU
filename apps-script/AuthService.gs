function DETWIL_isPasswordLoginEnabled() {
  var propValue = DETWIL_getScriptProperties_().getProperty(DETWIL.PROPERTY_KEYS.PASSWORD_LOGIN_ENABLED);
  return DETWIL_bool(propValue || 'TRUE');
}

function DETWIL_createPasswordCredential(userId, email, password) {
  if (!DETWIL_isPasswordLoginEnabled()) {
    DETWIL_raise('PASSWORD_LOGIN_DISABLED', 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วยรหัสผ่าน', 'Password login is disabled.');
  }
  DETWIL_validateRequired({ UserID: userId, Email: email, Password: password }, ['UserID', 'Email', 'Password']);
  if (!DETWIL_validateEmail(email)) {
    DETWIL_raise('INVALID_EMAIL', 'รูปแบบอีเมลไม่ถูกต้อง', 'Invalid email: ' + email);
  }
  var now = DETWIL_nowIso();
  var salt = DETWIL_uuid() + DETWIL_uuid();
  var algorithm = 'SHA256_ITERATED_V1';
  var hash = DETWIL_hashPassword_(password, salt, algorithm);
  var record = {
    CredentialID: DETWIL_uuid(),
    UserID: userId,
    Email: DETWIL_normalizeEmail(email),
    PasswordHash: hash,
    PasswordSalt: salt,
    PasswordAlgorithm: algorithm,
    PasswordUpdatedAt: now,
    MustChangePassword: 'TRUE',
    FailedLoginCount: 0,
    LockedUntil: '',
    LastFailedLoginAt: '',
    LastPasswordResetAt: now,
    ResetBy: DETWIL_getActiveEmail() || 'SYSTEM',
    CredentialStatus: 'ACTIVE',
    CreatedAt: now,
    CreatedBy: DETWIL_getActiveEmail() || 'SYSTEM',
    UpdatedAt: now,
    UpdatedBy: DETWIL_getActiveEmail() || 'SYSTEM',
    IsDeleted: 'FALSE'
  };
  DETWIL_appendRecord(DETWIL.SHEET_NAMES.AUTH_CREDENTIALS, record);
  DETWIL_logAudit({
    action: 'CREATE_PASSWORD_CREDENTIAL',
    entityType: 'AUTH_CREDENTIALS',
    entityId: record.CredentialID,
    result: 'SUCCESS',
    message: 'Password credential created as hash/salt only.'
  });
  return DETWIL_jsonSuccess({ credentialId: record.CredentialID });
}

function DETWIL_verifyPasswordLogin(email, password) {
  try {
    if (!DETWIL_isPasswordLoginEnabled()) {
      DETWIL_raise('PASSWORD_LOGIN_DISABLED', 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วยรหัสผ่าน', 'Password login is disabled.');
    }
    var normalizedEmail = DETWIL_normalizeEmail(email);
    var user = DETWIL_findFirstByField(DETWIL.SHEET_NAMES.USERS, 'Email', normalizedEmail);
    if (!user || String(user.AccountStatus) !== 'ACTIVE' || !DETWIL_bool(user.CanLogin)) {
      DETWIL_logAudit({
        actorEmail: normalizedEmail,
        action: 'PASSWORD_LOGIN',
        entityType: 'USERS',
        entityId: user ? user.UserID : '',
        result: 'FAIL',
        errorCode: 'USER_NOT_ALLOWED',
        message: 'Password login blocked because user is not allowed.'
      });
      return DETWIL_jsonError('USER_NOT_ALLOWED', 'บัญชีนี้ยังไม่ได้รับอนุญาตให้เข้าใช้งาน');
    }
    if (!DETWIL_bool(user.PasswordLoginEnabled)) {
      return DETWIL_jsonError('PASSWORD_LOGIN_NOT_ALLOWED', 'บัญชีนี้ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วยรหัสผ่าน');
    }
    var credential = DETWIL_findFirstByField(DETWIL.SHEET_NAMES.AUTH_CREDENTIALS, 'UserID', user.UserID);
    if (!credential || credential.CredentialStatus !== 'ACTIVE') {
      return DETWIL_jsonError('CREDENTIAL_NOT_FOUND', 'ยังไม่พบข้อมูลรหัสผ่านของบัญชีนี้');
    }
    if (credential.LockedUntil && new Date(credential.LockedUntil).getTime() > Date.now()) {
      return DETWIL_jsonError('ACCOUNT_LOCKED', 'บัญชีถูกล็อกชั่วคราว กรุณาลองใหม่ภายหลัง');
    }
    var expectedHash = DETWIL_hashPassword_(password, credential.PasswordSalt, credential.PasswordAlgorithm);
    var ok = expectedHash === credential.PasswordHash;
    if (!ok) {
      DETWIL_registerFailedPasswordLogin_(credential);
      return DETWIL_jsonError('INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
    }
    DETWIL_updateRecordById(DETWIL.SHEET_NAMES.AUTH_CREDENTIALS, 'CredentialID', credential.CredentialID, {
      FailedLoginCount: 0,
      LockedUntil: '',
      LastFailedLoginAt: '',
      UpdatedAt: DETWIL_nowIso(),
      UpdatedBy: 'AUTH_SERVICE'
    });
    DETWIL_updateRecordById(DETWIL.SHEET_NAMES.USERS, 'UserID', user.UserID, {
      LastLoginAt: DETWIL_nowIso(),
      LoginCount: Number(user.LoginCount || 0) + 1,
      UpdatedAt: DETWIL_nowIso(),
      UpdatedBy: 'AUTH_SERVICE'
    });
    DETWIL_logAudit({
      actorUserId: user.UserID,
      actorEmail: normalizedEmail,
      actorRole: user.PrimaryRole,
      action: 'PASSWORD_LOGIN',
      entityType: 'USERS',
      entityId: user.UserID,
      result: 'SUCCESS',
      message: 'Password login success.'
    });
    return DETWIL_jsonSuccess({
      userId: user.UserID,
      email: user.Email,
      displayName: user.DisplayName,
      primaryRole: user.PrimaryRole,
      schoolId: user.SchoolID,
      mustChangePassword: DETWIL_bool(credential.MustChangePassword)
    });
  } catch (err) {
    return DETWIL_handleError(err, { entityType: 'AUTH', entityId: email });
  }
}

function DETWIL_registerFailedPasswordLogin_(credential) {
  var failedCount = Number(credential.FailedLoginCount || 0) + 1;
  var lockedUntil = '';
  if (failedCount >= 5) {
    lockedUntil = Utilities.formatDate(new Date(Date.now() + 15 * 60 * 1000), DETWIL.PROJECT.defaultTimezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  DETWIL_updateRecordById(DETWIL.SHEET_NAMES.AUTH_CREDENTIALS, 'CredentialID', credential.CredentialID, {
    FailedLoginCount: failedCount,
    LockedUntil: lockedUntil,
    LastFailedLoginAt: DETWIL_nowIso(),
    UpdatedAt: DETWIL_nowIso(),
    UpdatedBy: 'AUTH_SERVICE'
  });
  DETWIL_logAudit({
    actorEmail: credential.Email,
    action: 'PASSWORD_LOGIN',
    entityType: 'AUTH_CREDENTIALS',
    entityId: credential.CredentialID,
    result: 'FAIL',
    errorCode: 'INVALID_CREDENTIALS',
    message: 'Invalid password attempt. Count: ' + failedCount
  });
}

function DETWIL_hashPassword_(password, salt, algorithm) {
  if (['SHA256_ITERATED_V1', 'SCRYPT_SHA256_V1'].indexOf(algorithm) < 0) {
    DETWIL_raise('UNSUPPORTED_PASSWORD_ALGORITHM', 'รูปแบบการเข้ารหัสรหัสผ่านไม่รองรับ', 'Unsupported algorithm: ' + algorithm);
  }
  var props = DETWIL_getScriptProperties_();
  var pepper = props.getProperty(DETWIL.PROPERTY_KEYS.PASSWORD_PEPPER) || '';
  var iterations = Number(props.getProperty(DETWIL.PROPERTY_KEYS.PASSWORD_ITERATIONS) || 12000);
  var hash = String(password || '');
  for (var i = 0; i < iterations; i += 1) {
    var bytes = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      salt + ':' + hash + ':' + pepper,
      Utilities.Charset.UTF_8
    );
    hash = Utilities.base64Encode(bytes);
  }
  return hash;
}
