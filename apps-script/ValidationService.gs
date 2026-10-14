function DETWIL_validateRequired(record, fields) {
  var missing = [];
  fields.forEach(function(field) {
    if (record[field] == null || String(record[field]).trim() === '') {
      missing.push(field);
    }
  });
  if (missing.length) {
    DETWIL_raise('VALIDATION_REQUIRED', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบ', 'Missing fields: ' + missing.join(', '));
  }
  return true;
}

function DETWIL_validateEmail(email) {
  var text = DETWIL_normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function DETWIL_validateSchemaIntegrity() {
  var problems = [];
  Object.keys(DETWIL.SHEET_SCHEMAS).forEach(function(sheetName) {
    var expected = DETWIL_getSchema(sheetName);
    var actual = DETWIL_getHeaders(sheetName);
    expected.forEach(function(header, index) {
      if (actual[index] !== header) {
        problems.push(sheetName + ': expected header ' + header + ' at column ' + (index + 1));
      }
    });
  });
  return {
    ok: problems.length === 0,
    problems: problems
  };
}
