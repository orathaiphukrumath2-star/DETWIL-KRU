import { CircleCheck, Cloud, LoaderCircle } from "lucide-react";
import { getAppsScriptHealth } from "@/lib/appsScript";

export function AppsScriptConnectionPending() {
  return <span className="connection-status connection-status--pending" role="status">
    <LoaderCircle size={15} className="loading-icon" aria-hidden="true" />กำลังตรวจการเชื่อมต่อ
  </span>;
}

export async function AppsScriptConnection() {
  const health = await getAppsScriptHealth();
  const Icon = health.ok ? CircleCheck : Cloud;
  return <span className={`connection-status ${health.ok ? "connection-status--ready" : "connection-status--pending"}`}
    title={health.ok ? "Google Sheets, Drive และโครงสร้างข้อมูลพร้อมเชื่อมต่อ" : health.error} role="status">
    <Icon size={15} aria-hidden="true" />{health.ok ? "เชื่อมต่อแหล่งข้อมูลแล้ว" : "รอการเชื่อมต่อแหล่งข้อมูล"}
  </span>;
}
