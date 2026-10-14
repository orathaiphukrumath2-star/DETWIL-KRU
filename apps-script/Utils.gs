function DETWIL_nowIso() {
  return Utilities.formatDate(new Date(), DETWIL.PROJECT.defaultTimezone, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

function DETWIL_uuid() {
  return Utilities.getUuid();
}

function DETWIL_normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function DETWIL_getActiveEmail() {
  try {
    return DETWIL_normalizeEmail(Session.getActiveUser().getEmail());
  } catch (err) {
    return '';
  }
}

function DETWIL_jsonSuccess(data, meta) {
  return {
    ok: true,
    data: data || null,
    meta: meta || {},
    timestamp: DETWIL_nowIso()
  };
}

function DETWIL_jsonError(code, message, details) {
  return {
    ok: false,
    error: {
      code: code || 'UNKNOWN_ERROR',
      message: message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
      details: details || null
    },
    timestamp: DETWIL_nowIso()
  };
}

function DETWIL_bool(value) {
  if (typeof value === 'boolean') return value;
  var text = String(value || '').trim().toUpperCase();
  return text === 'TRUE' || text === 'YES' || text === '1';
}

function DETWIL_safeString(value, maxLength) {
  var text = String(value == null ? '' : value).trim();
  var limit = maxLength || 5000;
  return text.length > limit ? text.slice(0, limit) : text;
}

function DETWIL_toRecord(headers, row) {
  var record = {};
  headers.forEach(function(header, index) {
    record[header] = row[index] == null ? '' : row[index];
  });
  return record;
}

function DETWIL_toRow(headers, record) {
  return headers.map(function(header) {
    return record[header] == null ? '' : record[header];
  });
}

function DETWIL_maskStack(stack) {
  return String(stack || '').split('\n').slice(0, 6).join('\n');
}
