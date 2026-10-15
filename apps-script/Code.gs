function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  if (params.health === '1') {
    return ContentService
      .createTextOutput(JSON.stringify(DETWIL_healthCheck()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService
    .createTextOutput(JSON.stringify(DETWIL_jsonSuccess({
      system: DETWIL.PROJECT.systemName,
      version: DETWIL.VERSION,
      message: 'DETWIL Apps Script API is running.'
    })))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    var action = body.action || '';
    var payload = body.payload || {};
    var result;

    if (action === 'setup') {
      result = DETWIL_jsonError('EDITOR_ONLY', 'กรุณารัน DETWIL_setupNewProject จาก Apps Script Editor เท่านั้น');
    } else if (action === 'health') {
      result = DETWIL_healthCheck();
    } else if (action === 'passwordLogin') {
      result = DETWIL_workApi_(action, payload, body.token);
    } else if (DETWIL_WORK_ACTIONS.indexOf(action) !== -1) {
      result = DETWIL_workApi_(action, payload, body.token);
    } else if (DETWIL_MEMBER_ACTIONS.indexOf(action) !== -1) {
      result = DETWIL_memberApi_(action, payload, body.token);
    } else if (DETWIL_RECOVERY_ACTIONS.indexOf(action) !== -1) {
      result = DETWIL_recoveryApi_(action, payload, body.token);
    } else {
      result = DETWIL_jsonError('UNKNOWN_ACTION', 'ไม่พบคำสั่งที่ร้องขอ', { action: action });
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify(DETWIL_handleError(err, { entityType: 'API' })))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function DETWIL_healthCheck() {
  var props = DETWIL_getScriptProperties_();
  var spreadsheetId = props.getProperty(DETWIL.PROPERTY_KEYS.SPREADSHEET_ID);
  var rootFolderId = props.getProperty(DETWIL.PROPERTY_KEYS.ROOT_FOLDER_ID);
  var schemaStatus = { ok: false, problems: ['Spreadsheet not connected yet.'] };
  if (spreadsheetId) {
    schemaStatus = DETWIL_validateSchemaIntegrity();
  }
  return DETWIL_jsonSuccess({
    system: DETWIL.PROJECT.systemName,
    version: DETWIL.VERSION,
    spreadsheetConnected: Boolean(spreadsheetId),
    rootFolderConnected: Boolean(rootFolderId),
    passwordLoginEnabled: DETWIL_isPasswordLoginEnabled(),
    schemaOk: schemaStatus.ok,
    schemaProblems: schemaStatus.problems
  });
}
