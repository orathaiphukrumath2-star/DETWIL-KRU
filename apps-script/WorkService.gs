var DETWIL_WORK_ACTIONS = ['activateOwner', 'publicWorks', 'publicWork', 'session', 'logout', 'changePassword', 'myWorks', 'getWork', 'saveWork', 'workflow', 'uploadFile', 'downloadFile', 'adminData', 'saveSchool', 'createUser'];
var DETWIL_WORK_TYPES = ['lesson', 'media', 'obec', 'research'];

function DETWIL_workError_(code, message) {
  var error = new Error(message);
  error.code = code;
  throw error;
}

function DETWIL_workText_(value, limit, required) {
  var text = String(value == null ? '' : value).trim();
  if ((required && !text) || text.length > limit) DETWIL_workError_('VALIDATION', 'กรุณากรอกข้อมูลให้ครบและไม่เกินความยาวที่กำหนด');
  return text;
}

function DETWIL_workHash_(text) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}

// These row helpers are used only inside the single workflow lock. Never nest repository locks.
function DETWIL_workWrite_(table, record, idField) {
  var sheet = DETWIL_getSheet(table);
  var headers = DETWIL_getHeaders(table);
  var row = DETWIL_toRow(headers, record).map(function(value) {
    return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value;
  });
  var target = sheet.getLastRow() + 1;
  if (idField) {
    var all = sheet.getDataRange().getValues();
    var index = headers.indexOf(idField);
    for (var i = 1; i < all.length; i++) {
      if (String(all[i][index]) === String(record[idField])) { target = i + 1; break; }
    }
  }
  sheet.getRange(target, 1, 1, headers.length).setValues([row]);
}

function DETWIL_upgradeWorkSystem_() {
  var book = DETWIL_getSpreadsheet();
  ['WORKS', 'AUTH_SESSIONS'].forEach(function(name) {
    var sheet = book.getSheetByName(name);
    if (!sheet || sheet.getLastRow() === 0) { DETWIL_ensureSheet(name); return; }
    var actual = sheet.getRange(1, 1, 1, DETWIL.SHEET_SCHEMAS[name].length).getValues()[0];
    if (JSON.stringify(actual) !== JSON.stringify(DETWIL.SHEET_SCHEMAS[name])) {
      DETWIL_workError_('SCHEMA_MISMATCH', 'หัวตาราง ' + name + ' ไม่ตรงกัน ระบบไม่ได้แก้ทับข้อมูลเดิม');
    }
  });
}

function DETWIL_owner_() {
  var email = DETWIL_getActiveEmail();
  var user = email && DETWIL_findFirstByField('USERS', 'Email', email);
  if (!user || user.PrimaryRole !== 'SUPER_ADMIN' || user.AccountStatus !== 'ACTIVE' || !DETWIL_bool(user.CanLogin)) {
    DETWIL_workError_('FORBIDDEN', 'เปิดด้วยบัญชี Google ผู้ดูแลระบบ หรือรัน DETWIL_prepareWorkSystem ในหน้าแก้ไข Apps Script');
  }
  return user;
}

// Editor-only bootstrap; its bearer link expires after 15 minutes and cannot reset an existing password.
function DETWIL_prepareWorkSystem() {
  var owner = DETWIL_owner_();
  DETWIL_upgradeWorkSystem_();
  if (DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', owner.UserID)) {
    console.log('อัปเกรดตารางแล้ว เข้าสู่ระบบด้วยรหัสผ่านเดิมที่ https://detwil-kru.vercel.app/studio');
    return;
  }
  var token = DETWIL_uuid() + DETWIL_uuid();
  DETWIL_getScriptProperties_().setProperty('DETWIL_OWNER_ACTIVATION', JSON.stringify({ hash: DETWIL_workHash_(token), userId: owner.UserID, expires: Date.now() + 900000 }));
  var url = 'https://detwil-kru.vercel.app/activate?token=' + encodeURIComponent(token);
  console.log('ตั้งรหัสผ่านด้วยตัวเองภายใน 15 นาที: ' + url);
  return { setupUrl: url };
}

function DETWIL_setupOwner_(token) {
  if (!token) return DETWIL_owner_();
  var record = JSON.parse(DETWIL_getScriptProperties_().getProperty('DETWIL_OWNER_ACTIVATION') || '{}');
  if (record.expires < Date.now() || record.hash !== DETWIL_workHash_(token)) DETWIL_workError_('FORBIDDEN', 'ลิงก์เปิดใช้งานไม่ถูกต้องหรือหมดอายุ');
  var user = DETWIL_findFirstByField('USERS', 'UserID', record.userId);
  if (!user || user.PrimaryRole !== 'SUPER_ADMIN' || user.AccountStatus !== 'ACTIVE' || !DETWIL_bool(user.CanLogin)) DETWIL_workError_('FORBIDDEN', 'บัญชีนี้ไม่ใช่ผู้ดูแลที่เปิดใช้งาน');
  return user;
}

function DETWIL_activateOwner_(password, displayName, token) {
  if (!token) DETWIL_workError_('FORBIDDEN', 'ต้องใช้ลิงก์จาก Apps Script Editor ของผู้ดูแล');
  var owner = DETWIL_setupOwner_(String(token || ''));
  DETWIL_upgradeWorkSystem_();
  DETWIL_checkNewPassword_(password);
  if (DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', owner.UserID)) DETWIL_workError_('ALREADY_ACTIVE', 'บัญชีนี้มีรหัสผ่านแล้ว กรุณาเข้าสู่ระบบ');
  var name = DETWIL_workText_(displayName, 150, true);
  var salt = DETWIL_uuid() + DETWIL_uuid();
  DETWIL_workWrite_('AUTH_CREDENTIALS', { CredentialID: DETWIL_uuid(), UserID: owner.UserID, Email: owner.Email, PasswordSalt: salt, PasswordHash: DETWIL_hashPassword_(password, salt, 'SHA256_ITERATED_V1'), PasswordAlgorithm: 'SHA256_ITERATED_V1', CredentialStatus: 'ACTIVE', MustChangePassword: 'FALSE', PasswordUpdatedAt: DETWIL_nowIso(), CreatedAt: DETWIL_nowIso(), CreatedBy: owner.UserID, IsDeleted: 'FALSE' });
  owner.DisplayName = name; owner.PasswordLoginEnabled = 'TRUE';
  DETWIL_workWrite_('USERS', owner, 'UserID');
  DETWIL_getScriptProperties_().deleteProperty('DETWIL_OWNER_ACTIVATION');
  return { ok: true };
}

function DETWIL_checkNewPassword_(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) DETWIL_workError_('VALIDATION', 'รหัสผ่านต้องมี 12–128 ตัวอักษร');
}

function DETWIL_sessionUser_(token, allowPasswordChange, allowNoRole) {
  if (!token || typeof token !== 'string' || token.length > 200) DETWIL_workError_('UNAUTHORIZED', 'กรุณาเข้าสู่ระบบ');
  var session = DETWIL_findFirstByField('AUTH_SESSIONS', 'TokenHash', DETWIL_workHash_(token));
  if (!session || !isFinite(new Date(session.ExpiresAt).getTime()) || new Date(session.ExpiresAt).getTime() <= Date.now() || !DETWIL_isPasswordLoginEnabled()) DETWIL_workError_('UNAUTHORIZED', 'หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่');
  var user = DETWIL_findFirstByField('USERS', 'UserID', session.UserID);
  if (!user || ['ACTIVE', 'PENDING'].indexOf(user.AccountStatus) < 0 || !DETWIL_bool(user.CanLogin) || (user.StartDate && new Date(user.StartDate).getTime() > Date.now()) || (user.EndDate && new Date(user.EndDate).getTime() < Date.now())) DETWIL_workError_('FORBIDDEN', 'บัญชีนี้ไม่สามารถเข้าใช้งานได้');
  var credential = DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', user.UserID);
  if (!credential || credential.CredentialStatus !== 'ACTIVE' || !DETWIL_bool(user.PasswordLoginEnabled)) DETWIL_workError_('UNAUTHORIZED', 'บัญชีนี้ไม่ได้เปิดใช้รหัสผ่าน');
  user.mustChangePassword = DETWIL_bool(credential.MustChangePassword);
  if (user.mustChangePassword && !allowPasswordChange) DETWIL_workError_('PASSWORD_CHANGE_REQUIRED', 'กรุณาเปลี่ยนรหัสผ่านชั่วคราวก่อนใช้งาน');
  user = DETWIL_memberContext_(user, session);
  if (!allowNoRole && (user.AccountStatus !== 'ACTIVE' || !user._activeRoleId)) DETWIL_workError_('FORBIDDEN', 'กรุณารออนุมัติหรือเลือกบทบาทที่มีสิทธิ์ใช้งาน');
  return user;
}

function DETWIL_identity_(user) {
  return DETWIL_memberIdentity_(user);
}

function DETWIL_workLogin_(payload) {
  if (String(payload.password || '').length > 128 || String(payload.email || '').length > 254 || !DETWIL_isPasswordLoginEnabled()) DETWIL_workError_('INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่พร้อมใช้งาน');
  var user = DETWIL_findFirstByField('USERS', 'Email', DETWIL_normalizeEmail(payload.email));
  var cred = user && DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', user.UserID);
  if (!user || ['ACTIVE', 'PENDING'].indexOf(user.AccountStatus) < 0 || !DETWIL_bool(user.CanLogin) || !DETWIL_bool(user.PasswordLoginEnabled) || !cred || cred.CredentialStatus !== 'ACTIVE' || (cred.LockedUntil && new Date(cred.LockedUntil).getTime() > Date.now()) || (user.StartDate && new Date(user.StartDate).getTime() > Date.now()) || (user.EndDate && new Date(user.EndDate).getTime() < Date.now())) DETWIL_workError_('INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่พร้อมใช้งาน');
  var passwordValue = cred.PasswordAlgorithm === 'SCRYPT_SHA256_V1' ? payload.passwordProof : payload.password;
  if (cred.PasswordAlgorithm === 'SCRYPT_SHA256_V1' && (typeof passwordValue !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(passwordValue))) DETWIL_workError_('INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  if (!passwordValue || DETWIL_hashPassword_(passwordValue, cred.PasswordSalt, cred.PasswordAlgorithm) !== cred.PasswordHash) {
    cred.FailedLoginCount = Number(cred.FailedLoginCount || 0) + 1;
    cred.LastFailedLoginAt = DETWIL_nowIso();
    if (cred.FailedLoginCount >= 5) cred.LockedUntil = new Date(Date.now() + 900000).toISOString();
    DETWIL_workWrite_('AUTH_CREDENTIALS', cred, 'CredentialID');
    DETWIL_workError_('INVALID_CREDENTIALS', 'อีเมลหรือรหัสผ่านไม่ถูกต้อง หรือบัญชียังไม่พร้อมใช้งาน');
  }
  cred.FailedLoginCount = 0; cred.LockedUntil = ''; cred.LastFailedLoginAt = '';
  if (cred.PasswordAlgorithm === 'SHA256_ITERATED_V1' && typeof payload.passwordProof === 'string' && /^[A-Za-z0-9+/]{43}=$/.test(payload.passwordProof)) {
    cred.PasswordSalt = DETWIL_uuid() + DETWIL_uuid();
    cred.PasswordAlgorithm = 'SCRYPT_SHA256_V1';
    cred.PasswordHash = DETWIL_hashPassword_(payload.passwordProof, cred.PasswordSalt, cred.PasswordAlgorithm);
    cred.PasswordUpdatedAt = DETWIL_nowIso();
  }
  DETWIL_workWrite_('AUTH_CREDENTIALS', cred, 'CredentialID');
  user.LastLoginAt = DETWIL_nowIso(); user.LoginCount = Number(user.LoginCount || 0) + 1;
  DETWIL_workWrite_('USERS', user, 'UserID');
  var sessionToken = DETWIL_uuid() + DETWIL_uuid();
  var maxAge = payload.remember === true ? 2592000 : 28800;
  var session = { SessionID: DETWIL_uuid(), TokenHash: DETWIL_workHash_(sessionToken), UserID: user.UserID, ExpiresAt: new Date(Date.now() + maxAge * 1000).toISOString(), CreatedAt: DETWIL_nowIso(), IsDeleted: 'FALSE', ActiveRoleID: '' };
  user = DETWIL_memberContext_(user, session);
  session.ActiveRoleID = user._activeRoleId;
  DETWIL_workWrite_('AUTH_SESSIONS', session);
  user.mustChangePassword = DETWIL_bool(cred.MustChangePassword);
  return { token: sessionToken, user: DETWIL_identity_(user), maxAge: maxAge };
}

function DETWIL_areaRole_(user) { return ['SUPER_ADMIN', 'AREA_ADMIN', 'SUPERVISOR'].indexOf(user.PrimaryRole) >= 0; }
function DETWIL_canReadWork_(user, work) { return user.UserID === work.OwnerUserID || DETWIL_areaRole_(user) || (user.PrimaryRole === 'SCHOOL_ADMIN' && user.SchoolID && user.SchoolID === work.SchoolID); }
function DETWIL_requireOwner_(user, work) { if (user.UserID !== work.OwnerUserID) DETWIL_workError_('FORBIDDEN', 'เฉพาะเจ้าของผลงานเท่านั้น'); }
function DETWIL_workRow_(id) {
  var work = DETWIL_findFirstByField('WORKS', 'WorkID', String(id || ''));
  if (!work) DETWIL_workError_('NOT_FOUND', 'ไม่พบผลงานหรือยังไม่ได้เผยแพร่');
  return work;
}

function DETWIL_cleanContent_(input, user, work) {
  var value = input || {};
  var schoolId = work ? work.SchoolID : (DETWIL_areaRole_(user) ? value.schoolId : user.SchoolID);
  var school = DETWIL_findFirstByField('SCHOOLS', 'SchoolID', String(schoolId || ''));
  if (!school || school.Status !== 'ACTIVE') DETWIL_workError_('VALIDATION', 'กรุณาระบุสถานศึกษาที่เปิดใช้งาน');
  var content = { title: DETWIL_workText_(value.title, 200, true), subject: DETWIL_workText_(value.subject, 100, true), gradeLevel: DETWIL_workText_(value.gradeLevel, 100, true), academicYear: DETWIL_workText_(value.academicYear, 4, true), workType: value.workType, description: DETWIL_workText_(value.description, 4000, true), objectives: DETWIL_workText_(value.objectives, 3000, false), results: DETWIL_workText_(value.results, 3000, false), authorName: user.DisplayName, schoolId: school.SchoolID, schoolName: school.SchoolName };
  if (!/^25\d{2}$/.test(content.academicYear) || DETWIL_WORK_TYPES.indexOf(content.workType) < 0) DETWIL_workError_('VALIDATION', 'ปีการศึกษาหรือประเภทผลงานไม่ถูกต้อง');
  if (!Array.isArray(value.attachments) || value.attachments.length > 20) DETWIL_workError_('VALIDATION', 'แนบหลักฐานได้ไม่เกิน 20 รายการ');
  content.attachments = value.attachments.map(function(item) {
    if (['PLAN', 'MEDIA', 'STUDENT', 'EVIDENCE'].indexOf(item.category) < 0) DETWIL_workError_('VALIDATION', 'ประเภทหลักฐานไม่ถูกต้อง');
    var attachment = { id: DETWIL_workText_(item.id || DETWIL_uuid(), 80, true), category: item.category, title: DETWIL_workText_(item.title, 200, true), isPublic: item.isPublic === true, url: '', fileId: '' };
    if (item.fileId) {
      var file = DETWIL_findFirstByField('FILES', 'FileRecordID', item.fileId);
      if (!work || !file || file.ParentID !== work.WorkID || file.UploadedBy !== user.UserID) DETWIL_workError_('FORBIDDEN', 'ไฟล์แนบไม่ใช่ของผลงานนี้');
      attachment.fileId = file.FileRecordID;
    } else {
      attachment.url = DETWIL_workText_(item.url, 2000, true);
      if (!/^https:\/\/[^\s/@]+(?:[/:?#][^\s]*)?$/i.test(attachment.url) || /^https:\/\/[^/]*@/i.test(attachment.url)) DETWIL_workError_('VALIDATION', 'ลิงก์ต้องเป็น https:// และไม่มีชื่อผู้ใช้หรือรหัสผ่านใน URL');
    }
    return attachment;
  });
  if (JSON.stringify(content).length > 40000) DETWIL_workError_('VALIDATION', 'ข้อมูลยาวเกินขนาดที่เก็บในชีตได้');
  return content;
}

function DETWIL_reviewStatus_(work, versionId) {
  var reviews = DETWIL_readAll('WORKFLOW_LOG').filter(function(row) { return row.RecordType === 'WORK' && row.RecordID === work.WorkID && row.VersionID === versionId; });
  var status = 'UNREVIEWED';
  reviews.forEach(function(row) { if (row.Action === 'APPROVE') status = row.ToApprovalStatus; });
  return status;
}

function DETWIL_publicProjection_(work) {
  if (!DETWIL_bool(work.IsPublic) || !work.PublishedVersionID || !work.PublishedJson) DETWIL_workError_('NOT_FOUND', 'ไม่พบผลงานหรือยังไม่ได้เผยแพร่');
  var content = JSON.parse(work.PublishedJson);
  content.attachments = content.attachments.filter(function(item) { return item.isPublic === true; });
  return { id: work.WorkID, content: content, versionId: work.PublishedVersionID, approvalStatus: DETWIL_reviewStatus_(work, work.PublishedVersionID), isPublic: true };
}

function DETWIL_privateProjection_(work) {
  return { id: work.WorkID, content: JSON.parse(work.ContentJson), versionId: work.CurrentVersionID, versionNo: Number(work.VersionNo), approvalStatus: work.ApprovalStatus, isPublic: DETWIL_bool(work.IsPublic), publishedVersionId: work.PublishedVersionID, ownerId: work.OwnerUserID, updatedAt: work.UpdatedAt };
}

function DETWIL_workLog_(work, user, action, previous, comment) {
  DETWIL_workWrite_('WORKFLOW_LOG', { WorkflowLogID: DETWIL_uuid(), RecordType: 'WORK', RecordID: work.WorkID, VersionID: work.CurrentVersionID, FromApprovalStatus: previous, ToApprovalStatus: work.ApprovalStatus, ToPublishLevel: DETWIL_bool(work.IsPublic) ? 'PUBLIC' : 'PRIVATE', Action: action, Comment: comment || '', ActorUserID: user.UserID, ActorRole: user.PrimaryRole, ActorSchoolID: user.SchoolID, CreatedAt: DETWIL_nowIso() });
}

function DETWIL_saveWork_(payload, user) {
  if (['TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'AREA_ADMIN', 'SUPERVISOR'].indexOf(user.PrimaryRole) < 0) DETWIL_workError_('FORBIDDEN', 'บัญชีนี้ไม่มีสิทธิ์สร้างผลงาน');
  var work = payload.id ? DETWIL_workRow_(payload.id) : null;
  if (work) {
    DETWIL_requireOwner_(user, work);
    if (payload.versionId !== work.CurrentVersionID) DETWIL_workError_('CONFLICT', 'มีการแก้ไขจากหน้าต่างอื่น กรุณาโหลดผลงานใหม่ก่อนบันทึก');
    if (['SCHOOL_PENDING', 'DISTRICT_PENDING'].indexOf(work.ApprovalStatus) >= 0) DETWIL_workError_('INVALID_STATE', 'ผลงานอยู่ระหว่างตรวจ ต้องถอนคำขอก่อนแก้ไข');
  }
  var content = DETWIL_cleanContent_(payload.content, user, work);
  var previous = work ? work.ApprovalStatus : '';
  var now = DETWIL_nowIso();
  work = work || { WorkID: DETWIL_uuid(), OwnerUserID: user.UserID, CreatedAt: now, IsDeleted: 'FALSE', IsPublic: 'FALSE', PublishedVersionID: '', PublishedJson: '', VersionNo: 0 };
  Object.assign(work, { SchoolID: content.schoolId, AuthorName: content.authorName, SchoolName: content.schoolName, Title: content.title, Subject: content.subject, GradeLevel: content.gradeLevel, AcademicYear: content.academicYear, WorkType: content.workType, ContentJson: JSON.stringify(content), VersionNo: Number(work.VersionNo) + 1, CurrentVersionID: DETWIL_uuid(), ApprovalStatus: 'DRAFT', UpdatedAt: now });
  DETWIL_workWrite_('RECORD_VERSIONS', { VersionID: work.CurrentVersionID, RecordType: 'WORK', RecordID: work.WorkID, VersionNo: work.VersionNo, SnapshotJson: work.ContentJson, ChangeReason: 'SAVE', VersionStatus: 'SAVED', CreatedAt: now, CreatedBy: user.UserID });
  DETWIL_workWrite_('WORKS', work, 'WorkID');
  DETWIL_workLog_(work, user, 'SAVE', previous);
  return DETWIL_privateProjection_(work);
}

function DETWIL_workflow_(payload, user) {
  var work = DETWIL_workRow_(payload.id);
  if (payload.versionId !== work.CurrentVersionID) DETWIL_workError_('CONFLICT', 'รุ่นผลงานเปลี่ยนแล้ว กรุณาโหลดใหม่');
  var previous = work.ApprovalStatus;
  var action = payload.command;
  var content = JSON.parse(work.ContentJson);
  var ownerActions = ['PUBLISH', 'UNPUBLISH', 'SUBMIT_SCHOOL', 'SUBMIT_DISTRICT', 'WITHDRAW'];
  if (ownerActions.indexOf(action) >= 0) DETWIL_requireOwner_(user, work);
  if (action === 'PUBLISH' || action === 'SUBMIT_SCHOOL') {
    if (!content.attachments.some(function(a) { return a.category === 'PLAN'; }) || !content.attachments.some(function(a) { return a.category === 'MEDIA'; })) DETWIL_workError_('VALIDATION', 'กรุณาแนบแผนการสอนและสื่อที่ใช้สอนอย่างน้อยประเภทละ 1 รายการ');
  }
  if (action === 'PUBLISH') {
    if (!content.attachments.some(function(a) { return a.category === 'PLAN' && a.isPublic; }) || !content.attachments.some(function(a) { return a.category === 'MEDIA' && a.isPublic; })) DETWIL_workError_('VALIDATION', 'กรุณาอนุญาตเผยแพร่แผนการสอนและสื่ออย่างน้อยประเภทละ 1 รายการ');
    var publicContent = JSON.parse(work.ContentJson);
    publicContent.attachments = publicContent.attachments.filter(function(a) { return a.isPublic; });
    work.IsPublic = 'TRUE'; work.PublishedVersionID = work.CurrentVersionID; work.PublishedJson = JSON.stringify(publicContent);
  } else if (action === 'UNPUBLISH') { work.IsPublic = 'FALSE';
  } else if (action === 'SUBMIT_SCHOOL' && ['DRAFT', 'RETURNED', 'REJECTED'].indexOf(previous) >= 0) { work.ApprovalStatus = 'SCHOOL_PENDING';
  } else if (action === 'SUBMIT_DISTRICT' && previous === 'SCHOOL_APPROVED') { work.ApprovalStatus = 'DISTRICT_PENDING';
  } else if (action === 'WITHDRAW' && ['SCHOOL_PENDING', 'DISTRICT_PENDING'].indexOf(previous) >= 0) { work.ApprovalStatus = previous === 'DISTRICT_PENDING' ? 'SCHOOL_APPROVED' : 'DRAFT';
  } else if (['APPROVE', 'RETURN', 'REJECT'].indexOf(action) >= 0) {
    var level = previous === 'SCHOOL_PENDING' ? 'SCHOOL' : previous === 'DISTRICT_PENDING' ? 'DISTRICT' : '';
    var allowed = level === 'SCHOOL' ? (user.PrimaryRole === 'SCHOOL_ADMIN' && user.SchoolID && user.SchoolID === work.SchoolID) : DETWIL_areaRole_(user);
    if (!level || !allowed || user.UserID === work.OwnerUserID) DETWIL_workError_('FORBIDDEN', 'ไม่มีสิทธิ์ตรวจผลงานนี้ หรือไม่สามารถตรวจผลงานตนเองได้');
    var comment = DETWIL_workText_(payload.comment, 2000, action !== 'APPROVE');
    work.ApprovalStatus = action === 'APPROVE' ? level + '_APPROVED' : action === 'RETURN' ? 'RETURNED' : 'REJECTED';
    DETWIL_workWrite_('REVIEWS', { ReviewID: DETWIL_uuid(), RecordType: 'WORK', RecordID: work.WorkID, VersionID: work.CurrentVersionID, ReviewLevel: level, ReviewerUserID: user.UserID, ReviewerRole: user.PrimaryRole, Decision: action, Comment: comment, ResolvedAt: DETWIL_nowIso(), CreatedAt: DETWIL_nowIso(), CreatedBy: user.UserID });
  } else { DETWIL_workError_('INVALID_STATE', 'ไม่สามารถเปลี่ยนสถานะด้วยคำสั่งนี้ได้'); }
  work.UpdatedAt = DETWIL_nowIso();
  DETWIL_workWrite_('WORKS', work, 'WorkID');
  DETWIL_workLog_(work, user, action, previous, payload.comment);
  return DETWIL_privateProjection_(work);
}

function DETWIL_uploadFile_(payload, user) {
  var work = DETWIL_workRow_(payload.id);
  DETWIL_requireOwner_(user, work);
  if (['SCHOOL_PENDING', 'DISTRICT_PENDING'].indexOf(work.ApprovalStatus) >= 0) DETWIL_workError_('INVALID_STATE', 'กรุณาถอนคำขอก่อนเพิ่มไฟล์');
  var name = DETWIL_workText_(payload.name, 180, true).replace(/[\\/\r\n]/g, '_');
  var mime = String(payload.mime || '');
  var allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'];
  if (allowed.indexOf(mime) < 0 || typeof payload.base64 !== 'string' || payload.base64.length > 2800000) DETWIL_workError_('VALIDATION', 'รองรับ PDF, รูปภาพ, DOCX, PPTX ขนาดไม่เกิน 2 MB');
  var bytes = Utilities.base64Decode(payload.base64);
  if (!bytes.length || bytes.length > 2097152) DETWIL_workError_('VALIDATION', 'ขนาดไฟล์ต้องไม่เกิน 2 MB');
  var root = DriveApp.getFolderById(DETWIL_getScriptProperties_().getProperty(DETWIL.PROPERTY_KEYS.ROOT_FOLDER_ID));
  if (root.getSharingAccess() !== DriveApp.Access.PRIVATE) DETWIL_workError_('VALIDATION', 'โฟลเดอร์หลัก Drive ต้องไม่เปิดแชร์สาธารณะก่อนอัปโหลดไฟล์หลักฐาน');
  var folders = root.getFoldersByName('WorkAttachments');
  var folder = folders.hasNext() ? folders.next() : root.createFolder('WorkAttachments');
  if (folder.getSharingAccess() !== DriveApp.Access.PRIVATE) DETWIL_workError_('VALIDATION', 'โฟลเดอร์ไฟล์แนบต้องไม่เปิดแชร์สาธารณะ');
  var file = folder.createFile(Utilities.newBlob(bytes, mime, DETWIL_uuid() + '-' + name));
  file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  var id = DETWIL_uuid();
  DETWIL_workWrite_('FILES', { FileRecordID: id, ParentType: 'WORK', ParentID: work.WorkID, DriveFileID: file.getId(), DriveFolderID: folder.getId(), OriginalFileName: name, StoredFileName: file.getName(), MimeType: mime, FileSize: bytes.length, AccessLevel: 'PRIVATE', UploadStatus: 'COMPLETE', UploadedBy: user.UserID, UploadedAt: DETWIL_nowIso(), IsDeleted: 'FALSE' });
  return { fileId: id, name: name };
}

function DETWIL_downloadFile_(payload, token) {
  var work = DETWIL_workRow_(payload.id);
  var content;
  if (payload.preview === true) {
    var user = DETWIL_sessionUser_(token, false);
    if (!DETWIL_canReadWork_(user, work)) DETWIL_workError_('FORBIDDEN', 'ไม่มีสิทธิ์อ่านไฟล์นี้');
    content = JSON.parse(work.ContentJson);
  } else { content = DETWIL_publicProjection_(work).content; }
  if (!content.attachments.some(function(a) { return a.fileId === payload.fileId; })) DETWIL_workError_('NOT_FOUND', 'ไม่พบไฟล์ในรุ่นผลงานนี้');
  var record = DETWIL_findFirstByField('FILES', 'FileRecordID', payload.fileId);
  if (!record || record.ParentID !== work.WorkID || record.ParentType !== 'WORK') DETWIL_workError_('NOT_FOUND', 'ไม่พบไฟล์แนบ');
  var blob = DriveApp.getFileById(record.DriveFileID).getBlob();
  if (blob.getBytes().length > 2097152) DETWIL_workError_('VALIDATION', 'ไฟล์เกินขนาดที่อนุญาต');
  return { name: record.OriginalFileName, mime: record.MimeType, base64: Utilities.base64Encode(blob.getBytes()) };
}

function DETWIL_workApi_(action, payload, token) {
  var lock;
  try {
    payload = payload || {};
    if (action === 'activateOwner') {
      lock = LockService.getScriptLock(); lock.waitLock(30000);
      return DETWIL_jsonSuccess(DETWIL_activateOwner_(payload.password, payload.displayName, payload.activationToken));
    }
    if (action === 'publicWorks') {
      var works = DETWIL_readAll('WORKS').filter(function(w) { return !DETWIL_bool(w.IsDeleted) && DETWIL_bool(w.IsPublic) && w.PublishedJson; });
      var approvals = {};
      DETWIL_readAll('WORKFLOW_LOG').forEach(function(r) { if (r.RecordType === 'WORK' && r.Action === 'APPROVE') approvals[r.VersionID] = r.ToApprovalStatus; });
      var summaries = works.map(function(w) { var c = JSON.parse(w.PublishedJson); return { id: w.WorkID, title: c.title, authorName: c.authorName, schoolName: c.schoolName, subject: c.subject, gradeLevel: c.gradeLevel, academicYear: c.academicYear, workType: c.workType, approvalStatus: approvals[w.PublishedVersionID] || 'UNREVIEWED' }; });
      var query = String(payload.search || '').toLowerCase().slice(0, 200);
      summaries = summaries.filter(function(w) { return (!payload.year || payload.year === 'all' || w.academicYear === payload.year) && (!payload.type || payload.type === 'all' || w.workType === payload.type) && (!query || [w.title, w.authorName, w.schoolName].join(' ').toLowerCase().indexOf(query) >= 0); });
      var page = Math.max(1, Math.min(10000, Math.floor(Number(payload.page) || 1)));
      var counts = {}; summaries.forEach(function(w) { counts[w.workType] = (counts[w.workType] || 0) + 1; });
      summaries.reverse();
      return DETWIL_jsonSuccess({ items: summaries.slice((page - 1) * 20, page * 20), total: summaries.length, page: page, counts: counts, schoolApproved: summaries.filter(function(s) { return s.approvalStatus === 'SCHOOL_APPROVED' || s.approvalStatus === 'DISTRICT_APPROVED'; }).length, districtApproved: summaries.filter(function(s) { return s.approvalStatus === 'DISTRICT_APPROVED'; }).length });
    }
    if (action === 'publicWork') return DETWIL_jsonSuccess(DETWIL_publicProjection_(DETWIL_workRow_(payload.id)));
    if (action === 'downloadFile') return DETWIL_jsonSuccess(DETWIL_downloadFile_(payload, token));
    if (action === 'passwordLogin') {
      lock = LockService.getScriptLock(); lock.waitLock(30000);
      return DETWIL_jsonSuccess(DETWIL_workLogin_(payload));
    }
    var limited = ['session', 'logout', 'changePassword'].indexOf(action) >= 0;
    var user = DETWIL_sessionUser_(token, limited, limited);
    if (action === 'session') return DETWIL_jsonSuccess(DETWIL_identity_(user));
    if (action === 'logout') {
      var session = DETWIL_findFirstByField('AUTH_SESSIONS', 'TokenHash', DETWIL_workHash_(token));
      DETWIL_updateRecordById('AUTH_SESSIONS', 'SessionID', session.SessionID, { IsDeleted: 'TRUE' });
      return DETWIL_jsonSuccess({ loggedOut: true });
    }
    if (action === 'changePassword') {
      lock = LockService.getScriptLock(); lock.waitLock(30000);
      var material = DETWIL_passwordMaterial_(payload);
      if (DETWIL_normalizeEmail(payload.email) !== user.Email) DETWIL_workError_('VALIDATION', 'อีเมลบัญชีไม่ตรงกัน');
      var cred = DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', user.UserID);
      var current = cred.PasswordAlgorithm === 'SCRYPT_SHA256_V1' ? payload.currentProof : payload.currentPassword;
      if (!current || DETWIL_hashPassword_(current, cred.PasswordSalt, cred.PasswordAlgorithm) !== cred.PasswordHash) DETWIL_workError_('INVALID_CREDENTIALS', 'รหัสผ่านเดิมไม่ถูกต้อง');
      var salt = DETWIL_uuid() + DETWIL_uuid();
      Object.assign(cred, { PasswordSalt: salt, PasswordAlgorithm: material.algorithm, PasswordHash: DETWIL_hashPassword_(material.value, salt, material.algorithm), MustChangePassword: 'FALSE', PasswordUpdatedAt: DETWIL_nowIso() });
      DETWIL_workWrite_('AUTH_CREDENTIALS', cred, 'CredentialID');
      DETWIL_readAll('AUTH_SESSIONS').filter(function(s) { return s.UserID === user.UserID; }).forEach(function(s) { s.IsDeleted = 'TRUE'; DETWIL_workWrite_('AUTH_SESSIONS', s, 'SessionID'); });
      return DETWIL_jsonSuccess({ changed: true });
    }
    if (action === 'myWorks') {
      var rows = DETWIL_readAll('WORKS').filter(function(w) { return !DETWIL_bool(w.IsDeleted) && DETWIL_canReadWork_(user, w) && (payload.queue ? (w.OwnerUserID !== user.UserID && (user.PrimaryRole === 'SCHOOL_ADMIN' ? w.ApprovalStatus === 'SCHOOL_PENDING' : DETWIL_areaRole_(user) && w.ApprovalStatus === 'DISTRICT_PENDING')) : w.OwnerUserID === user.UserID); });
      var offset = Math.max(0, Math.floor(Number(payload.offset) || 0));
      return DETWIL_jsonSuccess({ items: rows.slice(offset, offset + 30).map(DETWIL_privateProjection_), total: rows.length, schools: DETWIL_readAll('SCHOOLS').filter(function(s) { return s.Status === 'ACTIVE' && !DETWIL_bool(s.IsDeleted) && (DETWIL_areaRole_(user) || s.SchoolID === user.SchoolID); }).map(function(s) { return { id: s.SchoolID, name: s.SchoolName }; }) });
    }
    if (action === 'getWork') {
      var work = DETWIL_workRow_(payload.id);
      if (!DETWIL_canReadWork_(user, work)) DETWIL_workError_('FORBIDDEN', 'ไม่มีสิทธิ์อ่านผลงานนี้');
      var data = DETWIL_privateProjection_(work);
      data.history = DETWIL_readAll('WORKFLOW_LOG').filter(function(log) { return log.RecordType === 'WORK' && log.RecordID === work.WorkID; }).slice(-50).map(function(log) { return { action: log.Action, comment: log.Comment, role: log.ActorRole, createdAt: log.CreatedAt, versionId: log.VersionID }; });
      return DETWIL_jsonSuccess(data);
    }
    if (action === 'adminData') {
      if (user.PrimaryRole !== 'SUPER_ADMIN') DETWIL_workError_('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
      var schools = DETWIL_readAll('SCHOOLS').filter(function(s) { return !DETWIL_bool(s.IsDeleted); });
      var grants = DETWIL_readAll('USER_ROLES');
      return DETWIL_jsonSuccess({ schools: schools.map(function(s) { return { id: s.SchoolID, name: s.SchoolName, code: s.SchoolCode }; }), users: DETWIL_readAll('USERS').filter(function(u) { return !DETWIL_bool(u.IsDeleted); }).map(function(u) { return DETWIL_memberIdentity_(u, DETWIL_memberRoles_(u.UserID, grants, schools)); }) });
    }
    if (action === 'createUser') {
      lock = LockService.getScriptLock(); lock.waitLock(30000);
      if (user.PrimaryRole !== 'SUPER_ADMIN') DETWIL_workError_('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
      var newMaterial = DETWIL_passwordMaterial_(payload);
      var email = DETWIL_normalizeEmail(payload.email);
      if (!DETWIL_validateEmail(email) || DETWIL_findFirstByField('USERS', 'Email', email)) DETWIL_workError_('VALIDATION', 'อีเมลไม่ถูกต้องหรือมีบัญชีนี้แล้ว');
      if (['TEACHER', 'SCHOOL_ADMIN', 'AREA_ADMIN', 'SUPERVISOR'].indexOf(payload.role) < 0) DETWIL_workError_('VALIDATION', 'บทบาทไม่ถูกต้อง');
      if (['TEACHER', 'SCHOOL_ADMIN'].indexOf(payload.role) >= 0 && !DETWIL_findFirstByField('SCHOOLS', 'SchoolID', payload.schoolId)) DETWIL_workError_('VALIDATION', 'กรุณาระบุโรงเรียน');
      var schoolScoped = ['TEACHER', 'SCHOOL_ADMIN'].indexOf(payload.role) >= 0;
      var newUser = { UserID: DETWIL_uuid(), Email: email, DisplayName: DETWIL_workText_(payload.displayName, 150, true), PrimaryRole: payload.role, SchoolID: schoolScoped ? String(payload.schoolId || '') : '', CanLogin: 'TRUE', PasswordLoginEnabled: 'TRUE', AuthMode: 'PASSWORD', AccountStatus: 'ACTIVE', CreatedAt: DETWIL_nowIso(), CreatedBy: user.UserID, IsDeleted: 'FALSE' };
      DETWIL_workWrite_('AUTH_CREDENTIALS', DETWIL_memberCredential_(newUser, newMaterial, true, user.UserID));
      DETWIL_workWrite_('USERS', newUser);
      DETWIL_workWrite_('USER_ROLES', { UserRoleID: DETWIL_uuid(), UserID: newUser.UserID, RoleCode: newUser.PrimaryRole, ScopeType: newUser.SchoolID ? 'SCHOOL' : 'GLOBAL', ScopeID: newUser.SchoolID || 'DETWIL', Status: 'ACTIVE', CreatedAt: DETWIL_nowIso(), CreatedBy: user.UserID, IsDeleted: 'FALSE' });
      return DETWIL_jsonSuccess(DETWIL_identity_(newUser));
    }
    lock = LockService.getScriptLock(); lock.waitLock(30000);
    user = DETWIL_sessionUser_(token, false);
    if (action === 'saveSchool') {
      if (user.PrimaryRole !== 'SUPER_ADMIN') DETWIL_workError_('FORBIDDEN', 'เฉพาะผู้ดูแลระบบ');
      var code = DETWIL_workText_(payload.code, 30, true);
      if (DETWIL_findFirstByField('SCHOOLS', 'SchoolCode', code)) DETWIL_workError_('VALIDATION', 'รหัสโรงเรียนนี้มีแล้ว');
      var school = { SchoolID: DETWIL_uuid(), SchoolCode: code, SchoolName: DETWIL_workText_(payload.name, 200, true), Status: 'ACTIVE', CreatedAt: DETWIL_nowIso(), CreatedBy: user.UserID, IsDeleted: 'FALSE' };
      DETWIL_workWrite_('SCHOOLS', school);
      return DETWIL_jsonSuccess({ id: school.SchoolID, name: school.SchoolName });
    }
    if (action === 'saveWork') return DETWIL_jsonSuccess(DETWIL_saveWork_(payload, user));
    if (action === 'workflow') return DETWIL_jsonSuccess(DETWIL_workflow_(payload, user));
    if (action === 'uploadFile') return DETWIL_jsonSuccess(DETWIL_uploadFile_(payload, user));
    DETWIL_workError_('UNKNOWN_ACTION', 'ไม่พบคำสั่ง');
  } catch (err) {
    return DETWIL_jsonError(err.code || 'WORK_SYSTEM_NOT_READY', err.code ? err.message : 'ระบบผลงานยังไม่พร้อม กรุณาให้ผู้ดูแลรัน DETWIL_prepareWorkSystem ใน Apps Script');
  } finally { if (lock) lock.releaseLock(); }
}
