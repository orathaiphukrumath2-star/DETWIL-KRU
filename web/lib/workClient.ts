export async function memberApi<T>(
  action: string,
  payload: unknown = {},
): Promise<T> {
  try {
    const response = await fetch("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: AbortSignal.timeout(65000),
      body: JSON.stringify({ action, payload }),
    });
    let result;
    try {
      result = await response.json();
    } catch (error) {
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
      )
        throw error;
      throw new MemberApiError(
        "UNAVAILABLE",
        "เซิร์ฟเวอร์ตอบกลับไม่สมบูรณ์ กรุณาลองใหม่หรือติดต่อผู้ดูแล",
      );
    }
    if (!response.ok || !result?.ok)
      throw new MemberApiError(
        result?.error?.code || "UNAVAILABLE",
        result?.error?.message || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่",
      );
    return result.data as T;
  } catch (error) {
    if (error instanceof MemberApiError) throw error;
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new MemberApiError(
        "TIMEOUT",
        "การเชื่อมต่อใช้เวลานานเกินไป กรุณาตรวจสถานะล่าสุดก่อนส่งรายการซ้ำ",
      );
    throw new MemberApiError(
      "NETWORK",
      "เชื่อมต่อเว็บไซต์ไม่ได้ กรุณาตรวจอินเทอร์เน็ตแล้วลองใหม่",
    );
  }
}
export const membershipOptionsUrl = "/api/membership?v=open-membership-1";

export class MemberApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MemberApiError";
    this.code = code;
  }
}
