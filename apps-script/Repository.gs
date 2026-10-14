function DETWIL_getScriptProperties_() {
  return PropertiesService.getScriptProperties();
}

function DETWIL_getSpreadsheet() {
  var spreadsheetId = DETWIL_getScriptProperties_().getProperty(DETWIL.PROPERTY_KEYS.SPREADSHEET_ID);
  if (!spreadsheetId) {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('DETWIL_SPREADSHEET_ID is not set. Run DETWIL_setupNewProject first.');
  }
  return SpreadsheetApp.openById(spreadsheetId);
}

function DETWIL_getSheet(sheetName) {
  var spreadsheet = DETWIL_getSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Sheet not found: ' + sheetName);
  }
  return sheet;
}

function DETWIL_getSchema(sheetName) {
  var schema = DETWIL.SHEET_SCHEMAS[sheetName];
  if (!schema) {
    throw new Error('Unknown DETWIL sheet schema: ' + sheetName);
  }
  return schema.slice();
}

function DETWIL_ensureSheet(sheetName) {
  var spreadsheet = DETWIL_getSpreadsheet();
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }
  var headers = DETWIL_getSchema(sheetName);
  DETWIL_ensureHeaders(sheet, headers);
  return sheet;
}

function DETWIL_ensureHeaders(sheet, headers) {
  if (sheet.getMaxColumns() < headers.length) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  }
  var range = sheet.getRange(1, 1, 1, headers.length);
  var current = range.getValues()[0];
  var mustWrite = false;
  for (var i = 0; i < headers.length; i += 1) {
    if (current[i] !== headers[i]) {
      mustWrite = true;
      break;
    }
  }
  if (mustWrite) {
    range.setValues([headers]);
    range.setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
}

function DETWIL_getHeaders(sheetName) {
  var sheet = DETWIL_getSheet(sheetName);
  var lastColumn = Math.max(sheet.getLastColumn(), DETWIL_getSchema(sheetName).length);
  return sheet.getRange(1, 1, 1, lastColumn).getValues()[0].filter(String);
}

function DETWIL_readAll(sheetName) {
  var sheet = DETWIL_getSheet(sheetName);
  var headers = DETWIL_getHeaders(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  return values.map(function(row) {
    return DETWIL_toRecord(headers, row);
  });
}

function DETWIL_appendRecord(sheetName, record) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = DETWIL_ensureSheet(sheetName);
    var headers = DETWIL_getHeaders(sheetName);
    var row = DETWIL_toRow(headers, record);
    sheet.appendRow(row);
    return record;
  } finally {
    lock.releaseLock();
  }
}

function DETWIL_appendRecords(sheetName, records) {
  if (!records || !records.length) return [];
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = DETWIL_ensureSheet(sheetName);
    var headers = DETWIL_getHeaders(sheetName);
    var rows = records.map(function(record) {
      return DETWIL_toRow(headers, record);
    });
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    return records;
  } finally {
    lock.releaseLock();
  }
}

function DETWIL_findFirstByField(sheetName, fieldName, fieldValue) {
  var rows = DETWIL_readAll(sheetName);
  var expected = String(fieldValue);
  for (var i = 0; i < rows.length; i += 1) {
    if (String(rows[i][fieldName]) === expected && String(rows[i].IsDeleted || '').toUpperCase() !== 'TRUE') {
      return rows[i];
    }
  }
  return null;
}

function DETWIL_listRecords(sheetName, options) {
  var settings = options || {};
  var page = Math.max(Number(settings.page || 1), 1);
  var pageSize = Math.min(Math.max(Number(settings.pageSize || 50), 1), 200);
  var rows = DETWIL_readAll(sheetName).filter(function(row) {
    return String(row.IsDeleted || '').toUpperCase() !== 'TRUE';
  });
  var filters = settings.filters || {};
  Object.keys(filters).forEach(function(key) {
    var value = String(filters[key] || '').toLowerCase();
    if (!value) return;
    rows = rows.filter(function(row) {
      return String(row[key] || '').toLowerCase().indexOf(value) !== -1;
    });
  });
  var start = (page - 1) * pageSize;
  return {
    rows: rows.slice(start, start + pageSize),
    page: page,
    pageSize: pageSize,
    total: rows.length
  };
}

function DETWIL_updateRecordById(sheetName, idField, idValue, patch) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = DETWIL_getSheet(sheetName);
    var headers = DETWIL_getHeaders(sheetName);
    var idIndex = headers.indexOf(idField);
    if (idIndex === -1) throw new Error('ID field not found: ' + idField);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return null;
    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][idIndex]) === String(idValue)) {
        var current = DETWIL_toRecord(headers, values[i]);
        Object.keys(patch || {}).forEach(function(key) {
          current[key] = patch[key];
        });
        var targetRow = i + 2;
        sheet.getRange(targetRow, 1, 1, headers.length).setValues([DETWIL_toRow(headers, current)]);
        return current;
      }
    }
    return null;
  } finally {
    lock.releaseLock();
  }
}
