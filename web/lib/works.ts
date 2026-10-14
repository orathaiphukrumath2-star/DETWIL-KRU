export const approvalLabels: Record<string, string> = {
  DRAFT: "ฉบับร่าง",
  SCHOOL_PENDING: "รอโรงเรียนตรวจ",
  SCHOOL_APPROVED: "โรงเรียนรับรองแล้ว",
  DISTRICT_PENDING: "รอเขตตรวจ",
  DISTRICT_APPROVED: "เขตรับรองแล้ว",
  RETURNED: "ส่งกลับแก้ไข",
  REJECTED: "ไม่รับรอง",
  UNREVIEWED: "ยังไม่ได้รับการรับรอง",
};
export const categoryLabels: Record<string, string> = {
  PLAN: "แผนการจัดการเรียนรู้",
  MEDIA: "สื่อที่ใช้ตามแผน",
  STUDENT: "ผลงานผู้เรียน",
  EVIDENCE: "หลักฐานและผลการจัดการเรียนรู้",
};
export const typeLabels: Record<string, string> = {
  lesson: "แผนการเรียนรู้",
  media: "สื่อและนวัตกรรม",
  obec: "OBEC Content Center",
  research: "งานวิจัย",
};
export type Attachment = {
  id: string;
  category: string;
  title: string;
  url: string;
  fileId: string;
  isPublic: boolean;
};
export type WorkContent = {
  title: string;
  subject: string;
  gradeLevel: string;
  academicYear: string;
  workType: string;
  description: string;
  objectives: string;
  results: string;
  authorName: string;
  schoolId: string;
  schoolName: string;
  attachments: Attachment[];
};
export type Work = {
  id: string;
  content: WorkContent;
  versionId: string;
  versionNo?: number;
  approvalStatus: string;
  isPublic: boolean;
  ownerId?: string;
  publishedVersionId?: string;
  updatedAt?: string;
  history?: {
    action: string;
    comment: string;
    role: string;
    createdAt: string;
    versionId: string;
  }[];
};
export type Identity = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  schoolId: string;
  mustChangePassword: boolean;
  accountStatus: string;
  activeRoleId: string;
  roles: MemberRole[];
};
export type MemberRole = {
  id: string;
  role: string;
  scopeType: string;
  schoolId: string;
  schoolName: string;
  status: string;
  usable: boolean;
  startDate: string;
  endDate: string;
};
export const roleLabels: Record<string, string> = {
  TEACHER: "ครู / ผู้จัดทำผลงาน",
  SCHOOL_ADMIN: "ผู้ตรวจระดับโรงเรียน",
  SUPERVISOR: "ศึกษานิเทศก์ / ผู้ตรวจระดับเขต",
  AREA_ADMIN: "ผู้ดูแลระดับเขต",
  SUPER_ADMIN: "ผู้ดูแลระบบ",
  PUBLIC_VISITOR: "สมาชิกทั่วไป",
};
export const roleStatusLabels: Record<string, string> = {
  PENDING: "รออนุมัติ",
  ACTIVE: "อนุมัติแล้ว",
  REJECTED: "ไม่อนุมัติ",
  REVOKED: "ถอนสิทธิ์แล้ว",
};
export type RoleRequest = { role: string; schoolId: string };
export type School = { id: string; name: string; code?: string };
export type PublicSummary = {
  id: string;
  title: string;
  subject: string;
  authorName: string;
  schoolName: string;
  academicYear: string;
  gradeLevel: string;
  workType: string;
  approvalStatus: string;
};
export type PublicList = {
  items: PublicSummary[];
  total: number;
  page: number;
  counts: Record<string, number>;
  schoolApproved: number;
  districtApproved: number;
};
export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
