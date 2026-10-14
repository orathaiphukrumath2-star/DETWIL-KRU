import Link from "next/link";
export default function NotFound() {
  return (
    <main className="studio-container studio-empty">
      <h1>ไม่พบผลงานที่เผยแพร่</h1>
      <p>ผลงานอาจยังเป็นฉบับร่าง หรือผู้จัดทำปิดการเผยแพร่แล้ว</p>
      <Link className="primary-button" href="/">
        กลับคลังผลงาน
      </Link>
      <Link href="/studio">เข้าสู่ระบบเพื่อตรวจผลงาน</Link>
    </main>
  );
}
