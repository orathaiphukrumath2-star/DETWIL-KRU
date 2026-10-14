export const detwilProject = {
  shortName: "DETWIL",
  nameTh: "DETWIL: ระบบนิเวศดิจิทัลเพื่อพัฒนาผลงานครูและนวัตกรรมการเรียนรู้",
  nameEn: "Digital Ecosystem for Teacher Works and Learning Innovation",
  ownerAgency: "สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย",
  schoolCount: 31,
  currentPhase: "Phase 1 Foundation",
} as const;

export const lockedDecisions = [
  "Vercel/Next.js เป็นเว็บหลัก",
  "Google Sheets เป็นฐานข้อมูลยืดหยุ่นระยะแรก",
  "Google Drive เก็บไฟล์และเอกสาร",
  "ข้อมูลที่แก้บนชีตได้ควรอยู่บนชีตให้มากที่สุด",
  "รหัสผ่านเก็บเฉพาะ hash/salt ใน AUTH_CREDENTIALS",
  "Canvas Document Engine อยู่ใน MVP",
] as const;

export const moduleMap = [
  { key: "teacher-site", title: "เว็บไซต์ครู", color: "blue", status: "รอโครงข้อมูลครู" },
  { key: "media", title: "คลังสื่อและนวัตกรรม", color: "teal", status: "พร้อมเชื่อม MEDIA" },
  { key: "lesson", title: "แผนการจัดการเรียนรู้", color: "purple", status: "พร้อมเชื่อม LESSON_PLANS" },
  { key: "obec", title: "OBEC Content Center", color: "orange", status: "พร้อมเชื่อม OBEC_USAGE" },
  { key: "research", title: "งานวิจัย", color: "red", status: "พร้อมเชื่อม RESEARCH" },
  { key: "certificate", title: "เกียรติบัตรและเอกสารรับรอง", color: "gold", status: "รอ Canvas Engine" },
] as const;

export const foundationSteps = [
  "สร้างชีตและหัวคอลัมน์",
  "ตั้งค่า Drive root และ folder",
  "เชื่อม Repository กลาง",
  "เปิด Audit/Error log",
  "เตรียม Auth แบบ Google และ Password hash",
] as const;
