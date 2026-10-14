import {
  BadgeCheck,
  BookOpen,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  School,
  UserRound,
  Download,
  ShieldCheck,
} from "lucide-react";
import {
  approvalLabels,
  categoryLabels,
  safeExternalUrl,
  type Work,
} from "@/lib/works";

export function WorkView({
  work,
  preview = false,
}: {
  work: Work;
  preview?: boolean;
}) {
  const c = work.content;
  return (
    <article className="work-document">
      <header className="work-cover">
        <div className="work-cover-top">
          <span className="work-eyebrow">DETWIL / ผลงานการจัดการเรียนรู้</span>
          <BookOpen size={32} strokeWidth={1.5} />
        </div>
        <h1>{c.title}</h1>
        <div className="work-byline">
          <span>
            <UserRound size={16} />
            {c.authorName}
          </span>
          <span>
            <School size={16} />
            {c.schoolName}
          </span>
        </div>
        <div className="work-tags">
          <span>{c.subject}</span>
          <span>{c.gradeLevel}</span>
          <span>ปีการศึกษา {c.academicYear}</span>
          <span className="approval-badge">
            <BadgeCheck size={15} />
            {approvalLabels[work.approvalStatus] || work.approvalStatus}
          </span>
        </div>
      </header>
      {preview && (
        <div className="preview-banner">
          <ShieldCheck size={18} />
          ฉบับสำหรับผู้จัดทำและผู้ตรวจ · รวมหลักฐานที่ไม่เผยแพร่สาธารณะ
        </div>
      )}
      <div className="work-body">
        <section className="document-section">
          <h2>ภาพรวมการจัดการเรียนรู้</h2>
          <p className="preserve-text">{c.description}</p>
        </section>
        {c.objectives && (
          <section className="document-section">
            <h2>วัตถุประสงค์การเรียนรู้</h2>
            <p className="preserve-text">{c.objectives}</p>
          </section>
        )}
        {Object.entries(categoryLabels).map(([key, label], index) => {
          const items = c.attachments.filter((a) => a.category === key);
          return (
            items.length > 0 && (
              <section className="document-section" key={key}>
                <div className="document-section-heading">
                  <span className="section-number">0{index + 1}</span>
                  <h2>{label}</h2>
                  <span>{items.length} รายการ</span>
                </div>
                <ul className="evidence-list">
                  {items.map((a) => {
                    const href = a.fileId
                      ? `/api/works/file?work=${encodeURIComponent(work.id)}&file=${encodeURIComponent(a.fileId)}${preview ? "&preview=1" : ""}`
                      : safeExternalUrl(a.url);
                    return (
                      <li key={a.id}>
                        {key === "MEDIA" ? (
                          <ImageIcon size={22} />
                        ) : (
                          <FileText size={22} />
                        )}
                        <div>
                          <strong>{a.title}</strong>
                          <span>
                            {a.fileId ? "ไฟล์แนบ" : "ลิงก์ภายนอก"}
                            {preview && !a.isPublic
                              ? " · ไม่เผยแพร่สาธารณะ"
                              : ""}
                          </span>
                        </div>
                        {href && (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="icon-button"
                            title={a.fileId ? "ดาวน์โหลดไฟล์" : "เปิดหลักฐาน"}
                            aria-label={`${a.fileId ? "ดาวน์โหลด" : "เปิด"} ${a.title}`}
                          >
                            {a.fileId ? (
                              <Download size={19} />
                            ) : (
                              <ExternalLink size={19} />
                            )}
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )
          );
        })}
        {c.results && (
          <section className="document-section">
            <h2>ผลการจัดการเรียนรู้และการสะท้อนผล</h2>
            <p className="preserve-text">{c.results}</p>
          </section>
        )}
      </div>
      <footer className="work-document-footer">
        DETWIL · สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย
      </footer>
    </article>
  );
}
