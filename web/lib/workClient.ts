export async function memberApi<T>(
  action: string,
  payload: unknown = {},
): Promise<T> {
  const response = await fetch("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok)
    throw new MemberApiError(
      result?.error?.code || "UNAVAILABLE",
      result?.error?.message || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่",
    );
  return result.data as T;
}
export const membershipOptionsUrl = "/api/membership?v=school-roles-1";

export class MemberApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "MemberApiError";
    this.code = code;
  }
}
