function DETWIL_handleError(err, context) {
  var errorId = DETWIL_uuid();
  var code = err && err.code ? err.code : 'SYSTEM_ERROR';
  var userMessage = err && err.userMessage ? err.userMessage : 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง';
  var technicalMessage = err && err.message ? err.message : String(err);
  var record = {
    ErrorID: errorId,
    ErrorCode: code,
    ErrorLevel: 'ERROR',
    UserMessage: userMessage,
    TechnicalMessage: technicalMessage,
    StackTraceMasked: DETWIL_maskStack(err && err.stack),
    EntityType: context && context.entityType ? context.entityType : '',
    EntityID: context && context.entityId ? context.entityId : '',
    ActorUserID: context && context.actorUserId ? context.actorUserId : '',
    CreatedAt: DETWIL_nowIso(),
    ResolvedAt: '',
    ResolvedBy: ''
  };
  try {
    DETWIL_appendRecord(DETWIL.SHEET_NAMES.SYSTEM_ERRORS, record);
    DETWIL_logAudit({
      action: 'SYSTEM_ERROR',
      entityType: record.EntityType,
      entityId: record.EntityID,
      result: 'FAIL',
      errorCode: code,
      message: technicalMessage
    });
  } catch (logErr) {
    console.error('Error logging failed', logErr);
  }
  return DETWIL_jsonError(code, userMessage, { errorId: errorId });
}

function DETWIL_raise(code, userMessage, technicalMessage) {
  var err = new Error(technicalMessage || userMessage || code);
  err.code = code;
  err.userMessage = userMessage;
  throw err;
}
