import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, LockKeyhole } from "lucide-react";
import { callWorkApi, sessionCookie, WorkApiError } from "@/lib/workServer";
import { WorkView } from "@/components/WorkView";
import type { Work } from "@/lib/works";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const metadata = {
  title: "ผลงานการจัดการเรียนรู้ | DETWIL",
  robots: { index: false, follow: false },
};
export default async function PublicWorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const preview = (await searchParams).preview === "1";
  let work: Work;
  try {
    work = await callWorkApi<Work>(
      preview ? "getWork" : "publicWork",
      { id },
      preview ? (await cookies()).get(sessionCookie)?.value || "" : "",
    );
  } catch (error) {
    if (error instanceof WorkApiError && error.code === "NOT_FOUND") notFound();
    return (
      <main className="studio-container">
        <Link href="/">DETWIL</Link>
        <div className="studio-empty">
          <LockKeyhole size={32} />
          <h1>
            {preview
              ? "กรุณาเข้าสู่ระบบเพื่อดูผลงาน"
              : "ยังไม่สามารถเปิดผลงานได้"}
          </h1>
          <p>
            {error instanceof WorkApiError
              ? error.message
              : "ไม่สามารถเชื่อมต่อหลังบ้านได้"}
          </p>
          <Link
            className="primary-button"
            href={`/studio?id=${encodeURIComponent(id)}`}
          >
            ไปยังพื้นที่จัดการผลงาน
          </Link>
        </div>
      </main>
    );
  }
  return (
    <main className="public-work-page">
      <nav className="document-nav">
        <Link href="/">
          <ArrowLeft size={17} />
          คลังผลงาน DETWIL
        </Link>
        {preview && (
          <Link href={`/studio?id=${encodeURIComponent(id)}`}>
            <Pencil size={16} />
            จัดการ / ตรวจผลงาน
          </Link>
        )}
      </nav>
      <WorkView work={work} preview={preview} />
    </main>
  );
}
