function DETWIL_createInitialSuperAdminFromActiveUser() {
  try {
    DETWIL_ensureAllSheets();
    var email = DETWIL_getActiveEmail();
    if (!email) {
      DETWIL_raise(
        'ACTIVE_EMAIL_NOT_FOUND',
        'ไม่พบอีเมลบัญชี Google ที่กำลังรันสคริปต์',
        'Session.getActiveUser().getEmail() returned empty.'
      );
    }

    var now = DETWIL_nowIso();
    var existingUser = DETWIL_findFirstByField(DETWIL.SHEET_NAMES.USERS, 'Email', email);
    var userId = existingUser ? existingUser.UserID : DETWIL_uuid();

    if (existingUser) {
      DETWIL_updateRecordById(DETWIL.SHEET_NAMES.USERS, 'UserID', userId, {
        PrimaryRole: DETWIL.ROLES.SUPER_ADMIN,
        AccountStatus: 'ACTIVE',
        CanLogin: 'TRUE',
        AuthMode: DETWIL.AUTH_MODES.BOTH,
        PasswordLoginEnabled: existingUser.PasswordLoginEnabled || 'FALSE',
        UpdatedAt: now,
        UpdatedBy: email,
        IsDeleted: 'FALSE'
      });
    } else {
      DETWIL_appendRecord(DETWIL.SHEET_NAMES.USERS, {
        UserID: userId,
        Email: email,
        DisplayName: '[โปรดเติมข้อมูลจริง: ชื่อผู้ดูแลระบบ]',
        SchoolID: '',
        PrimaryRole: DETWIL.ROLES.SUPER_ADMIN,
        AccountStatus: 'ACTIVE',
        CanLogin: 'TRUE',
        AuthMode: DETWIL.AUTH_MODES.BOTH,
        PasswordLoginEnabled: 'FALSE',
        LastLoginAt: '',
        LoginCount: 0,
        StartDate: '',
        EndDate: '',
        CreatedAt: now,
        CreatedBy: email,
        UpdatedAt: now,
        UpdatedBy: email,
        IsDeleted: 'FALSE',
        DeletedAt: '',
        DeletedBy: ''
      });
    }

    DETWIL_ensureRoleForUser_(userId, DETWIL.ROLES.SUPER_ADMIN, email);
    DETWIL_logAudit({
      actorUserId: userId,
      actorEmail: email,
      actorRole: DETWIL.ROLES.SUPER_ADMIN,
      action: 'CREATE_INITIAL_SUPER_ADMIN',
      entityType: 'USERS',
      entityId: userId,
      result: 'SUCCESS',
      message: 'Initial Super Admin created or refreshed from active Google account.'
    });

    var result = DETWIL_jsonSuccess({
      userId: userId,
      email: email,
      role: DETWIL.ROLES.SUPER_ADMIN,
      nextStep: 'เปิดชีต USERS และ USER_ROLES เพื่อตรวจว่ามีบัญชี Super Admin แล้ว'
    });
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (err) {
    var handled = DETWIL_handleError(err, { entityType: 'USERS' });
    console.log(JSON.stringify(handled, null, 2));
    return handled;
  }
}

function DETWIL_ensureRoleForUser_(userId, roleCode, actorEmail) {
  var roles = DETWIL_readAll(DETWIL.SHEET_NAMES.USER_ROLES);
  var exists = roles.some(function(row) {
    return String(row.UserID) === String(userId) &&
      String(row.RoleCode) === String(roleCode) &&
      String(row.ScopeType) === 'GLOBAL' &&
      String(row.IsDeleted || '').toUpperCase() !== 'TRUE';
  });
  if (exists) return;

  var now = DETWIL_nowIso();
  DETWIL_appendRecord(DETWIL.SHEET_NAMES.USER_ROLES, {
    UserRoleID: DETWIL_uuid(),
    UserID: userId,
    RoleCode: roleCode,
    ScopeType: 'GLOBAL',
    ScopeID: 'DETWIL',
    StartDate: '',
    EndDate: '',
    Status: 'ACTIVE',
    CreatedAt: now,
    CreatedBy: actorEmail || 'SYSTEM',
    UpdatedAt: now,
    UpdatedBy: actorEmail || 'SYSTEM',
    IsDeleted: 'FALSE'
  });
}
