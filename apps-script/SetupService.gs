function DETWIL_setupNewProject() {
  var props = DETWIL_getScriptProperties_();
  var spreadsheetId = props.getProperty(DETWIL.PROPERTY_KEYS.SPREADSHEET_ID);
  var rootFolderId = props.getProperty(DETWIL.PROPERTY_KEYS.ROOT_FOLDER_ID);

  if (!spreadsheetId) {
    var spreadsheet = SpreadsheetApp.create('DETWIL Database - [โปรดเติมข้อมูลจริง: ชื่อหน่วยงาน]');
    spreadsheetId = spreadsheet.getId();
    props.setProperty(DETWIL.PROPERTY_KEYS.SPREADSHEET_ID, spreadsheetId);
  }

  if (!rootFolderId) {
    var root = DriveApp.createFolder('DETWIL_ROOT');
    rootFolderId = root.getId();
    props.setProperty(DETWIL.PROPERTY_KEYS.ROOT_FOLDER_ID, rootFolderId);
  }

  DETWIL_seedScriptProperties_();
  DETWIL_ensureAllSheets();
  DETWIL_seedSettings();
  DETWIL_ensureDriveStructure(rootFolderId);
  DETWIL_logAudit({
    action: 'SETUP_PROJECT',
    entityType: 'SYSTEM',
    entityId: spreadsheetId,
    result: 'SUCCESS',
    message: 'DETWIL foundation setup completed.'
  });

  var result = DETWIL_jsonSuccess({
    spreadsheetId: spreadsheetId,
    rootFolderId: rootFolderId,
    version: DETWIL.VERSION
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function DETWIL_connectExistingProject(spreadsheetId, rootFolderId) {
  if (!spreadsheetId) throw new Error('spreadsheetId is required.');
  if (!rootFolderId) throw new Error('rootFolderId is required.');
  var props = DETWIL_getScriptProperties_();
  props.setProperty(DETWIL.PROPERTY_KEYS.SPREADSHEET_ID, spreadsheetId);
  props.setProperty(DETWIL.PROPERTY_KEYS.ROOT_FOLDER_ID, rootFolderId);
  DETWIL_seedScriptProperties_();
  DETWIL_ensureAllSheets();
  DETWIL_seedSettings();
  DETWIL_ensureDriveStructure(rootFolderId);
  var result = DETWIL_jsonSuccess({
    spreadsheetId: spreadsheetId,
    rootFolderId: rootFolderId,
    version: DETWIL.VERSION
  });
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function DETWIL_seedScriptProperties_() {
  var props = DETWIL_getScriptProperties_();
  var defaults = {};
  defaults[DETWIL.PROPERTY_KEYS.PASSWORD_LOGIN_ENABLED] = 'TRUE';
  defaults[DETWIL.PROPERTY_KEYS.PASSWORD_ITERATIONS] = '12000';
  defaults[DETWIL.PROPERTY_KEYS.PASSWORD_PEPPER] = props.getProperty(DETWIL.PROPERTY_KEYS.PASSWORD_PEPPER) || DETWIL_uuid() + DETWIL_uuid();
  defaults[DETWIL.PROPERTY_KEYS.GOOGLE_CLIENT_ID] = '[โปรดเติมข้อมูลจริง: Google OAuth Client ID]';
  defaults[DETWIL.PROPERTY_KEYS.VERCEL_BASE_URL] = '[โปรดเติมข้อมูลจริง: Vercel URL]';
  defaults[DETWIL.PROPERTY_KEYS.MAX_UPLOAD_BYTES] = '[โปรดเติมข้อมูลจริง: ขนาดไฟล์อัปโหลดสูงสุด]';
  defaults[DETWIL.PROPERTY_KEYS.ALLOWED_FILE_TYPES] = '[โปรดเติมข้อมูลจริง: ประเภทไฟล์ที่อนุญาต]';
  defaults[DETWIL.PROPERTY_KEYS.CURRENT_ACADEMIC_YEAR] = '[โปรดเติมข้อมูลจริง: ปีการศึกษาเริ่มต้น]';
  defaults[DETWIL.PROPERTY_KEYS.CURRENT_FISCAL_YEAR] = '[โปรดเติมข้อมูลจริง: ปีงบประมาณเริ่มต้น]';

  Object.keys(defaults).forEach(function(key) {
    if (!props.getProperty(key)) {
      props.setProperty(key, defaults[key]);
    }
  });
}

function DETWIL_ensureAllSheets() {
  Object.keys(DETWIL.SHEET_SCHEMAS).forEach(function(sheetName) {
    DETWIL_ensureSheet(sheetName);
  });
  return DETWIL_jsonSuccess({ sheetCount: Object.keys(DETWIL.SHEET_SCHEMAS).length });
}

function DETWIL_seedSettings() {
  var existing = DETWIL_readAll(DETWIL.SHEET_NAMES.SETTINGS).reduce(function(map, row) {
    map[row.SettingKey] = true;
    return map;
  }, {});
  var now = DETWIL_nowIso();
  var actor = DETWIL_getActiveEmail() || 'SYSTEM';
  var records = DETWIL.DEFAULT_SETTINGS
    .filter(function(item) {
      return !existing[item[0]];
    })
    .map(function(item) {
      return {
        SettingKey: item[0],
        SettingValue: item[1],
        ValueType: item[2],
        Description: item[3],
        IsSecret: item[4],
        UpdatedAt: now,
        UpdatedBy: actor
      };
    });
  DETWIL_appendRecords(DETWIL.SHEET_NAMES.SETTINGS, records);
  return DETWIL_jsonSuccess({ inserted: records.length });
}

function DETWIL_ensureDriveStructure(rootFolderId) {
  var root = DriveApp.getFolderById(rootFolderId);
  var system = DETWIL_getOrCreateFolder_(root, '01_SYSTEM');
  ['Templates', 'Signatures', 'Seals', 'Exports', 'Reports', 'Backups', 'Logs'].forEach(function(name) {
    DETWIL_getOrCreateFolder_(system, name);
  });
  DETWIL_getOrCreateFolder_(root, '02_SCHOOLS');
  var area = DETWIL_getOrCreateFolder_(root, '03_AREA_REPOSITORY');
  ['Media', 'LessonPlans', 'Research', 'BestPractice', 'Certificates', 'OfficialDocuments'].forEach(function(name) {
    DETWIL_getOrCreateFolder_(area, name);
  });
  DETWIL_getOrCreateFolder_(root, '04_ARCHIVE');
  return DETWIL_jsonSuccess({ rootFolderId: rootFolderId });
}

function DETWIL_getOrCreateFolder_(parentFolder, folderName) {
  var folders = parentFolder.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return parentFolder.createFolder(folderName);
}
