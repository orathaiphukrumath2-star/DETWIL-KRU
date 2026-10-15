export function fileResponseHeaders(
  name: string,
  mime: string,
  inline: boolean,
) {
  const canInline =
    inline &&
    ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(mime);
  const encoded = encodeURIComponent(name.replace(/[\r\n]/g, "")).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return {
    "Content-Type": canInline ? mime : "application/octet-stream",
    "Content-Disposition": `${canInline ? "inline" : "attachment"}; filename*=UTF-8''${encoded}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox",
  };
}
