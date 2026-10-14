"use client";
import Link from "next/link";
import { useState } from "react";
import { LockKeyhole, Save } from "lucide-react";
export function ActivationForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <main className="studio-container">
      <Link href="/" className="studio-brand">
        DETWIL
      </Link>
      <form
        className="login-form password-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          if (data.get("password") !== data.get("confirm")) {
            setMessage("รหัสผ่านไม่ตรงกัน");
            return;
          }
          setBusy(true);
          setMessage("");
          try {
            const response = await fetch("/api/works", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "activateOwner",
                payload: {
                  activationToken: token,
                  displayName: data.get("name"),
                  password: data.get("password"),
                },
              }),
            });
            const body = await response.json();
            if (!body.ok)
              throw new Error(body?.error?.message || "ไม่สามารถเปิดใช้งานได้");
            form.reset();
            window.history.replaceState(null, "", "/activate");
            setDone(true);
            setMessage(
              "เปิดใช้งานแล้ว กรุณาเข้าสู่ระบบด้วยอีเมลผู้ดูแลและรหัสผ่านที่ตั้งไว้",
            );
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "เชื่อมต่อไม่สำเร็จ",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <LockKeyhole size={25} />
        <h1>เปิดใช้งานผู้ดูแล</h1>
        {done ? (
          <Link href="/studio" className="primary-button">
            เข้าสู่ระบบ
          </Link>
        ) : !token ? (
          <p>
            กรุณารัน DETWIL_prepareWorkSystem ใน Apps Script Editor
            แล้วเปิดลิงก์จากบันทึกการดำเนินการ
          </p>
        ) : (
          <>
            <label>
              ชื่อผู้ดูแล
              <input name="name" required maxLength={150} autoComplete="name" />
            </label>
            <label>
              รหัสผ่านใหม่ (12–128 ตัวอักษร)
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              ยืนยันรหัสผ่าน
              <input
                name="confirm"
                type="password"
                minLength={12}
                maxLength={128}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="primary-button" disabled={busy}>
              <Save size={17} />
              {busy ? "กำลังเปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </>
        )}
        {message && <p role="status">{message}</p>}
      </form>
    </main>
  );
}
