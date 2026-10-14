import { scrypt } from "node:crypto";

const attempts = new Map<string, { count: number; resetAt: number }>();
export function allowAuthAttempt(key: string, now = Date.now()) {
  for (const [id, bucket] of attempts)
    if (bucket.resetAt <= now) attempts.delete(id);
  if (attempts.size >= 2000 && !attempts.has(key)) return false;
  const bucket = attempts.get(key) || { count: 0, resetAt: now + 600000 };
  bucket.count++;
  attempts.set(key, bucket);
  return bucket.count <= 20;
}

// The email-bound scrypt proof is never stored directly: GAS adds a random salt and its existing pepper.
export async function passwordProof(email: string, password: string) {
  return await new Promise<string>((resolve, reject) => {
    scrypt(
      password,
      `DETWIL-password-v1:${email.trim().toLowerCase()}`,
      32,
      { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key.toString("base64"))),
    );
  });
}

export async function preparePasswordPayload(
  action: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  const value =
    input && typeof input === "object" && !Array.isArray(input)
      ? ({ ...input } as Record<string, unknown>)
      : {};
  const actions = [
    "register",
    "passwordLogin",
    "changePassword",
    "createUser",
    "resetMemberPassword",
  ];
  if (!actions.includes(action)) return value;
  const email =
    typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const password = value.password;
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("กรุณากรอกอีเมลให้ถูกต้อง");
  if (
    typeof password !== "string" ||
    password.length > 128 ||
    password.length < (action === "passwordLogin" ? 1 : 12)
  )
    throw new Error("รหัสผ่านต้องมี 12–128 ตัวอักษร");
  value.email = email;
  value.passwordProof = await passwordProof(email, password);
  if (action !== "passwordLogin") delete value.password;
  if (action === "changePassword") {
    if (
      typeof value.currentPassword !== "string" ||
      !value.currentPassword ||
      value.currentPassword.length > 128
    )
      throw new Error("กรุณากรอกรหัสผ่านเดิม");
    value.currentProof = await passwordProof(email, value.currentPassword);
  }
  return value;
}
