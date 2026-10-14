export function isSameOrigin(origin: string | null, host: string | null, protocol: string) {
  if (!origin || !host || !["http", "https"].includes(protocol)) return false;
  try { return new URL(origin).origin === origin && origin === `${protocol}://${host}`; }
  catch { return false; }
}
