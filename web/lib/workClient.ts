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
    throw new Error(
      result?.error?.message || "ไม่สามารถดำเนินการได้ กรุณาลองใหม่",
    );
  return result.data as T;
}
