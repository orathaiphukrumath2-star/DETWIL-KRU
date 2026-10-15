import type { Attachment, Work, WorkList } from "./works";

export const gradeLevels = Array.from(
  { length: 6 },
  (_, index) => `มัธยมศึกษาปีที่ ${index + 1}`,
);
export function normalizeGrade(value: string) {
  const match = String(value || "")
    .replace(/\s/g, "")
    .match(/^(?:ม\.?|m\.?|(?:ชั้น)?มัธยมศึกษาปีที่)([1-6])$/i);
  return match ? `มัธยมศึกษาปีที่ ${match[1]}` : "";
}
export const workThemes = [
  { code: "classic", name: "เรียบง่ายเป็นทางการ" },
  { code: "bright", name: "สีสันสร้างสรรค์" },
  { code: "editorial", name: "บันทึกการเรียนรู้" },
] as const;
export const workColors = [
  { code: "teal", name: "เขียวทะเล", color: "#08766b", tint: "#e8f7f2" },
  { code: "blue", name: "ฟ้าสดใส", color: "#245ac7", tint: "#edf3ff" },
  { code: "rose", name: "ชมพูสดใส", color: "#ba285d", tint: "#fff0f4" },
  { code: "green", name: "เขียวใบไม้", color: "#267538", tint: "#edf8ed" },
  { code: "amber", name: "เหลืองอำพัน", color: "#995500", tint: "#fff6dd" },
] as const;
export function presentation(theme?: string, color?: string) {
  return {
    theme: workThemes.find((item) => item.code === theme) || workThemes[0],
    color: workColors.find((item) => item.code === color) || workColors[0],
  };
}
export function attachmentHref(
  workId: string,
  item: Attachment,
  preview = false,
) {
  if (item.fileId)
    return workId
      ? `/api/works/file?work=${encodeURIComponent(workId)}&file=${encodeURIComponent(item.fileId)}&inline=1${preview ? "&preview=1" : ""}`
      : "";
  try {
    const url = new URL(item.url);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}

// Apply the server-confirmed record without an extra Google round trip after every save.
export function updateWorkList(
  list: WorkList,
  work: Work,
  created: boolean,
  queue: boolean,
) {
  const exists = list.items.some((item) => item.id === work.id);
  if (queue) {
    const waiting = ["SCHOOL_PENDING", "DISTRICT_PENDING"].includes(
      work.approvalStatus,
    );
    return {
      ...list,
      items: waiting
        ? list.items.map((item) => (item.id === work.id ? work : item))
        : list.items.filter((item) => item.id !== work.id),
      total: Math.max(0, list.total - (exists && !waiting ? 1 : 0)),
    };
  }
  return {
    ...list,
    items: created
      ? [work, ...list.items.filter((item) => item.id !== work.id)].slice(0, 30)
      : list.items.map((item) => (item.id === work.id ? work : item)),
    total: list.total + (created && !exists ? 1 : 0),
  };
}
