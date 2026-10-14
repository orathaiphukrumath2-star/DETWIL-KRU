// SMIS codes: June 2026 secondary-school directory; sources are recorded in docs/membership-th.md.
var DETWIL_NONGKHAI_SCHOOLS = [
  ['43012001', 'ปทุมเทพวิทยาคาร'],
  ['43012002', 'หินโงมพิทยาคม'],
  ['43012003', 'กวนวันวิทยา'],
  ['43012004', 'เวียงคำวิทยาคาร'],
  ['43012005', 'หนองคายวิทยาคาร'],
  ['43012006', 'พระธาตุบังพวนวิทยา'],
  ['43012007', 'ค่ายบกหวานวิทยา'],
  ['43012008', 'ท่าบ่อ'],
  ['43012009', 'โคกคอนวิทยาคม'],
  ['43012010', 'ถ่อนวิทยา'],
  ['43012011', 'ท่าบ่อพิทยาคม'],
  ['43012012', 'หนองนางพิทยาคม'],
  ['43012013', 'เดื่อวิทยาคาร'],
  ['43012014', 'พานพร้าว'],
  ['43012015', 'พระพุทธบาทวิทยาคม'],
  ['43012016', 'วรลาโภนุสรณ์'],
  ['43012017', 'สังคมวิทยา'],
  ['43012018', 'วังม่วงพิทยาคม'],
  ['43012019', 'น้ำสวยวิทยา'],
  ['43012020', 'ฝางพิทยาคม'],
  ['43012021', 'โพธิ์ตากพิทยาคม'],
  ['43022001', 'ชุมพลโพนพิสัย'],
  ['43022002', 'เซิมพิทยาคม'],
  ['43022003', 'ปากสวยพิทยาคม'],
  ['43022004', 'นาหนังพัฒนศึกษา'],
  ['43022005', 'ร่มธรรมานุสรณ์'],
  ['43022006', 'กุดบงพิทยาคาร'],
  ['43022015', 'วังหลวงพิทยาสรรพ์'],
  ['43022016', 'นาดีพิทยาคม'],
  ['43022017', 'ประชาบดีพิทยาคม'],
  ['43022018', 'พระบาทนาสิงห์พิทยาคม']
];

function DETWIL_schoolNameKey_(name) {
  return String(name || '').trim().replace(/^โรงเรียน\s*/, '').replace(/\s+/g, '');
}

// Preflight every existing table before creating or extending any header.
function DETWIL_registrationSchemaPlan_(book) {
  return Object.keys(DETWIL.SHEET_SCHEMAS).map(function(name) {
    var sheet = book.getSheetByName(name);
    if (!sheet || sheet.getLastRow() === 0) return { name: name, operation: 'CREATE' };
    var expected = DETWIL.SHEET_SCHEMAS[name];
    var width = Math.max(sheet.getLastColumn(), expected.length);
    var headers = sheet.getRange(1, 1, 1, width).getValues()[0];
    while (headers.length && headers[headers.length - 1] === '') headers.pop();
    if (JSON.stringify(headers) === JSON.stringify(expected)) return { name: name, operation: 'KEEP' };
    if (name === 'AUTH_SESSIONS' && JSON.stringify(headers) === JSON.stringify(expected.slice(0, -1))) return { name: name, operation: 'APPEND_ROLE' };
    DETWIL_workError_('SCHEMA_MISMATCH', 'หัวตาราง ' + name + ' ไม่ตรงกัน หยุดโดยไม่แก้ไขข้อมูล กรุณาตรวจหัวคอลัมน์ก่อน');
  });
}

function DETWIL_schoolSeedRows_(existing, actorId) {
  var now = DETWIL_nowIso();
  return DETWIL_NONGKHAI_SCHOOLS.filter(function(entry) {
    // Include deleted/inactive rows in matching, so manual deactivation is never undone.
    return !existing.some(function(row) {
      return String(row.SchoolCode || '') === entry[0] || DETWIL_schoolNameKey_(row.SchoolName) === DETWIL_schoolNameKey_(entry[1]);
    });
  }).map(function(entry) {
    return { SchoolID: DETWIL_uuid(), SchoolCode: entry[0], SchoolName: entry[1], Province: 'หนองคาย', Status: 'ACTIVE', CreatedAt: now, CreatedBy: actorId, UpdatedAt: now, UpdatedBy: actorId, IsDeleted: 'FALSE' };
  });
}

// Editor-only. Uses the connected database, never creates a second database or grants member roles.
function DETWIL_prepareSchoolRegistration() {
  var owner = DETWIL_owner_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var book = DETWIL_getSpreadsheet();
    var plan = DETWIL_registrationSchemaPlan_(book);
    plan.forEach(function(item) {
      if (item.operation === 'CREATE') DETWIL_ensureSheet(item.name);
      if (item.operation === 'APPEND_ROLE') {
        var sheet = book.getSheetByName(item.name);
        var length = DETWIL.SHEET_SCHEMAS[item.name].length;
        if (sheet.getMaxColumns() < length) sheet.insertColumnsAfter(sheet.getMaxColumns(), length - sheet.getMaxColumns());
        sheet.getRange(1, length).setValue('ActiveRoleID').setFontWeight('bold');
      }
    });
    var schools = DETWIL_readAll('SCHOOLS');
    var additions = DETWIL_schoolSeedRows_(schools, owner.UserID);
    var schoolSheet = book.getSheetByName('SCHOOLS');
    if (additions.length) {
      var headers = DETWIL_getHeaders('SCHOOLS');
      schoolSheet.getRange(schoolSheet.getLastRow() + 1, 1, additions.length, headers.length).setValues(additions.map(function(row) { return DETWIL_toRow(headers, row); }));
    }
    schoolSheet.setFrozenRows(1);
    if (book.getName().indexOf('DETWIL Database - [โปรดเติมข้อมูลจริง:') === 0) book.rename('DETWIL Database - สพม.หนองคาย');
    DETWIL_memberAudit_(owner, 'PREPARE_SCHOOL_REGISTRATION', 'SCHOOLS', 'Added schools: ' + additions.length);
    var report = {
      spreadsheetUrl: book.getUrl() + '#gid=' + schoolSheet.getSheetId(),
      tableCount: plan.length,
      createdTables: plan.filter(function(item) { return item.operation === 'CREATE'; }).map(function(item) { return item.name; }),
      addedSchools: additions.length,
      activeSchools: DETWIL_registrationOptions_().schools.length,
      ownerPasswordReady: Boolean(DETWIL_findFirstByField('AUTH_CREDENTIALS', 'UserID', owner.UserID)),
      pendingRoleRequests: DETWIL_readAll('USER_ROLES').filter(function(row) { return row.Status === 'PENDING' && !DETWIL_bool(row.IsDeleted); }).length
    };
    console.log(JSON.stringify(report, null, 2));
    return report;
  } finally {
    lock.releaseLock();
  }
}
