function DETWIL_logAudit(entry) {
  try {
    var actorEmail = DETWIL_getActiveEmail();
    var record = {
      AuditID: DETWIL_uuid(),
      ActorUserID: entry.actorUserId || '',
      ActorEmail: entry.actorEmail || actorEmail || 'SYSTEM',
      ActorRole: entry.actorRole || '',
      Action: entry.action || 'UNKNOWN',
      EntityType: entry.entityType || '',
      EntityID: entry.entityId || '',
      Result: entry.result || 'SUCCESS',
      ErrorCode: entry.errorCode || '',
      Message: DETWIL_safeString(entry.message || '', 2000),
      ClientContextJson: entry.clientContextJson || '',
      CreatedAt: DETWIL_nowIso()
    };
    DETWIL_appendRecord(DETWIL.SHEET_NAMES.AUDIT_LOG, record);
    return record;
  } catch (err) {
    console.error('Audit log failed', err);
    return null;
  }
}
