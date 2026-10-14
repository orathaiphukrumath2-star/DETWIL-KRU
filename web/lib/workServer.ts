import { getAppsScriptUrl } from "./appsScript";

export const sessionCookie = "detwil_session";
export class WorkApiError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export async function callWorkApi<T>(
  action: string,
  payload: unknown = {},
  token = "",
): Promise<T> {
  const url = new URL(getAppsScriptUrl());
  if (
    url.protocol !== "https:" ||
    url.hostname !== "script.google.com" ||
    url.username ||
    url.password ||
    url.port ||
    !/^\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url.pathname)
  )
    throw new WorkApiError("CONFIGURATION", "ยังไม่ได้เชื่อม Apps Script");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload, token }),
    cache: "no-store",
    signal: AbortSignal.timeout(55000),
  });
  if (
    !response.ok ||
    !response.headers.get("content-type")?.includes("application/json")
  )
    throw new WorkApiError(
      "UNAVAILABLE",
      "หลังบ้านไม่ตอบกลับ กรุณาลองใหม่ภายหลัง",
    );
  const body = await response.json();
  if (body?.ok !== true)
    throw new WorkApiError(
      String(body?.error?.code || "UNAVAILABLE"),
      String(body?.error?.message || "ไม่สามารถดำเนินการได้"),
    );
  return body.data as T;
}
export function errorResponse(error: unknown) {
  const code = error instanceof WorkApiError ? error.code : "UNAVAILABLE";
  const message =
    error instanceof WorkApiError
      ? error.message
      : "เชื่อมต่อหลังบ้านไม่สำเร็จ กรุณาลองใหม่ภายหลัง";
  const status =
    code === "UNAUTHORIZED" || code === "INVALID_CREDENTIALS"
      ? 401
      : code === "FORBIDDEN" || code === "PASSWORD_CHANGE_REQUIRED"
        ? 403
        : code === "NOT_FOUND"
          ? 404
          : code === "CONFLICT"
            ? 409
            : ["VALIDATION", "INVALID_STATE"].includes(code)
              ? 400
              : 503;
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
