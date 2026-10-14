export type AppsScriptHealth = {
  ok: boolean;
  configured: boolean;
  urlHost?: string;
  data?: {
    system?: string;
    version?: string;
    spreadsheetConnected?: boolean;
    rootFolderConnected?: boolean;
    passwordLoginEnabled?: boolean;
    schemaOk?: boolean;
    schemaProblems?: string[];
  };
  error?: string;
};

export function getAppsScriptUrl() {
  const value = (process.env.APPS_SCRIPT_WEB_APP_URL || "").trim();
  if (!value || value.startsWith("[")) return "";
  return value;
}

export async function getAppsScriptHealth(): Promise<AppsScriptHealth> {
  const baseUrl = getAppsScriptUrl();
  if (!baseUrl) {
    return {
      ok: false,
      configured: false,
      error: "ยังไม่ได้ตั้งค่า APPS_SCRIPT_WEB_APP_URL",
    };
  }

  try {
    const healthUrl = new URL(baseUrl);
    if (
      healthUrl.protocol !== "https:" ||
      healthUrl.hostname !== "script.google.com" ||
      healthUrl.username ||
      healthUrl.password ||
      healthUrl.port ||
      !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(healthUrl.pathname)
    ) {
      return {
        ok: false,
        configured: true,
        error: "กรุณาตั้งค่า URL จากการ Deploy Web App ของ Google Apps Script",
      };
    }
    healthUrl.searchParams.set("health", "1");
    const response = await fetch(healthUrl.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return {
        ok: false,
        configured: true,
        urlHost: healthUrl.host,
        error: `Apps Script response ${response.status}`,
      };
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      return {
        ok: false,
        configured: true,
        urlHost: healthUrl.host,
        error: "Apps Script ไม่ได้ส่ง JSON กลับมา กรุณาตรวจสิทธิ์เข้าถึง Web App",
      };
    }
    const body = await response.json();
    const data = body?.data;
    if (
      body?.ok !== true ||
      !data ||
      data.system !== "DETWIL" ||
      typeof data.spreadsheetConnected !== "boolean" ||
      typeof data.rootFolderConnected !== "boolean" ||
      typeof data.schemaOk !== "boolean" ||
      (data.schemaProblems !== undefined &&
        (!Array.isArray(data.schemaProblems) ||
          !data.schemaProblems.every((problem: unknown) => typeof problem === "string")))
    ) {
      return {
        ok: false,
        configured: true,
        urlHost: healthUrl.host,
        error: "ผลตรวจจาก Apps Script ไม่สมบูรณ์ กรุณาตรวจ deployment และ schema",
      };
    }
    const ready = data.spreadsheetConnected && data.rootFolderConnected && data.schemaOk;
    return {
      ok: ready,
      configured: true,
      urlHost: healthUrl.host,
      data: {
        system: data.system,
        version: typeof data.version === "string" ? data.version : undefined,
        spreadsheetConnected: data.spreadsheetConnected,
        rootFolderConnected: data.rootFolderConnected,
        schemaOk: data.schemaOk,
        schemaProblems: data.schemaProblems,
      },
      error: ready ? undefined : "Google Sheets, Drive หรือ schema ยังไม่พร้อมใช้งาน",
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      error: error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)
        ? "Apps Script ใช้เวลาตอบกลับเกิน 15 วินาที กรุณาลองอีกครั้ง"
        : "ไม่สามารถเชื่อม Apps Script ได้ กรุณาตรวจ URL และการเผยแพร่ Web App",
    };
  }
}
