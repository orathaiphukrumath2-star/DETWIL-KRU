function DETWIL_createManualBackup() {
  try {
    var spreadsheet = DETWIL_getSpreadsheet();
    var rootFolderId = DETWIL_getScriptProperties_().getProperty(DETWIL.PROPERTY_KEYS.ROOT_FOLDER_ID);
    if (!rootFolderId) {
      DETWIL_raise('ROOT_FOLDER_NOT_SET', 'ยังไม่ได้ตั้งค่า Root Folder ID', 'DETWIL_ROOT_FOLDER_ID is missing.');
    }
    var root = DriveApp.getFolderById(rootFolderId);
    var archive = DETWIL_getOrCreateFolder_(root, '04_ARCHIVE');
    var backupName = 'DETWIL Backup ' + DETWIL_nowIso().replace(/[:]/g, '-');
    var backupFile = DriveApp.getFileById(spreadsheet.getId()).makeCopy(backupName, archive);
    DETWIL_logAudit({
      action: 'CREATE_BACKUP',
      entityType: 'SPREADSHEET',
      entityId: backupFile.getId(),
      result: 'SUCCESS',
      message: 'Manual backup created.'
    });
    return DETWIL_jsonSuccess({
      backupFileId: backupFile.getId(),
      backupName: backupName
    });
  } catch (err) {
    return DETWIL_handleError(err, { entityType: 'BACKUP' });
  }
}
