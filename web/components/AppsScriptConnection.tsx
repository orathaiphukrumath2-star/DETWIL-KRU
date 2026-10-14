import { StatusBadge } from "@/components/StatusBadge";
import { getAppsScriptHealth } from "@/lib/appsScript";

export function AppsScriptConnectionPending() {
  return (
    <div className="panel connection-panel" aria-busy="true">
      <div className="panel-header">
        <h2>Apps Script Connection</h2>
        <StatusBadge tone="waiting">กำลังตรวจ</StatusBadge>
      </div>
      <p className="connection-note" role="status">กำลังตรวจการเชื่อมต่อ Google Sheets และ Drive</p>
    </div>
  );
}

export async function AppsScriptConnection() {
  const health = await getAppsScriptHealth();
  const tone = health.ok ? "ready" : health.configured ? "waiting" : "locked";
  const label = health.ok ? "เชื่อมแล้ว" : health.configured ? "ตรวจอีกครั้ง" : "รอ URL";

  return (
    <div className="panel connection-panel">
      <div className="panel-header">
        <h2>Apps Script Connection</h2>
        <StatusBadge tone={tone}>{label}</StatusBadge>
      </div>
      <dl className="connection-list">
        <div>
          <dt>Web App URL</dt>
          <dd>{health.configured ? health.urlHost || "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้งค่า"}</dd>
        </div>
        <div>
          <dt>Spreadsheet</dt>
          <dd>{health.data?.spreadsheetConnected ? "เชื่อมแล้ว" : "รอตรวจ"}</dd>
        </div>
        <div>
          <dt>Drive Root</dt>
          <dd>{health.data?.rootFolderConnected ? "เชื่อมแล้ว" : "รอตรวจ"}</dd>
        </div>
        <div>
          <dt>Schema</dt>
          <dd>{health.data?.schemaOk ? "ผ่าน" : health.error || "รอตรวจ"}</dd>
        </div>
      </dl>
      <p className="connection-note">
        {health.data?.schemaProblems?.length
          ? health.data.schemaProblems.slice(0, 2).join(", ")
          : health.error || "Google Sheets และ Drive พร้อมเชื่อมต่อ"}
      </p>
    </div>
  );
}
