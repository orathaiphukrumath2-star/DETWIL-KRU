"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCheck,
  Copy,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  Send,
} from "lucide-react";
import { memberApi } from "@/lib/workClient";

function RecoveryLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <Link className="studio-brand" href="/">
          DETWIL<span>สมาชิกและผลงานครู</span>
        </Link>
        <Link className="text-link" href="/studio">
          <ArrowLeft size={17} /> เข้าสู่ระบบ
        </Link>
      </header>
      <main className="studio-container recovery-container">
        <div className="registration-brand">
          <img
            src="/images/agency-logos.png"
            width={180}
            height={101}
            alt="ตราหน่วยงาน สพม.หนองคาย"
          />
          <div>
            <span className="section-kicker">DETWIL MEMBERSHIP</span>
            <h1>{title}</h1>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

export function ForgotPassword() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <RecoveryLayout title="ลืมรหัสผ่าน">
      {error && (
        <div role="alert" className="studio-alert">
          {error}
        </div>
      )}
      {done ? (
        <section className="registration-success" role="status">
          <CheckCheck size={36} />
          <h2>รับคำขอแล้ว</h2>
          <p>
            หากอีเมลนี้มีบัญชีที่เปิดใช้งาน ผู้ดูแลจะพบคำขอตั้งรหัสใหม่
            กรุณาติดต่อผู้ดูแลเพื่อยืนยันตัวตนและรับลิงก์ส่วนตัว
          </p>
          <Link className="primary-button" href="/studio">
            <KeyRound size={17} /> กลับเข้าสู่ระบบ
          </Link>
        </section>
      ) : (
        <form
          className="recovery-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setBusy(true);
            setError("");
            try {
              await memberApi("recoveryRequest", {
                email: data.get("email"),
                website: data.get("website"),
              });
              form.reset();
              setDone(true);
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              อีเมลที่สมัครสมาชิก
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="username"
              />
            </label>
            <div className="registration-honeypot" aria-hidden="true">
              <label>
                เว็บไซต์ส่วนตัว
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <button className="primary-button">
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <Send size={17} />
              )}
              {busy ? "กำลังส่งคำขอ" : "ขอตั้งรหัสใหม่"}
            </button>
          </fieldset>
          <Link className="text-link" href="/studio">
            <ArrowLeft size={17} /> กลับเข้าสู่ระบบ
          </Link>
        </form>
      )}
    </RecoveryLayout>
  );
}

export function ResetPassword({ token }: { token: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  return (
    <RecoveryLayout title="ตั้งรหัสผ่านใหม่">
      {error && (
        <div role="alert" className="studio-alert">
          {error}
        </div>
      )}
      {done ? (
        <section className="registration-success" role="status">
          <CheckCheck size={36} />
          <h2>ตั้งรหัสผ่านใหม่แล้ว</h2>
          <p>กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่</p>
          <Link className="primary-button" href="/studio">
            <KeyRound size={17} /> เข้าสู่ระบบ
          </Link>
        </section>
      ) : !/^[a-f0-9-]{72}$/i.test(token) ? (
        <div className="studio-alert" role="alert">
          ไม่พบลิงก์ตั้งรหัสผ่านที่ถูกต้อง{" "}
          <Link className="text-link" href="/forgot-password">
            ขอลิงก์ใหม่
          </Link>
        </div>
      ) : (
        <form
          className="recovery-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            setError("");
            if (data.get("password") !== data.get("confirm")) {
              setError("รหัสผ่านใหม่ไม่ตรงกัน");
              return;
            }
            setBusy(true);
            try {
              await memberApi("completePasswordReset", {
                token,
                email: data.get("email"),
                password: data.get("password"),
              });
              form.reset();
              window.history.replaceState(null, "", "/reset-password");
              setDone(true);
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "ตั้งรหัสผ่านไม่สำเร็จ",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy}>
            <label>
              อีเมลที่สมัครสมาชิก
              <input
                name="email"
                type="email"
                required
                maxLength={254}
                autoComplete="username"
              />
            </label>
            <label>
              รหัสผ่านใหม่ (12–128 ตัวอักษร)
              <input
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <label>
              ยืนยันรหัสผ่านใหม่
              <input
                name="confirm"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </label>
            <button className="primary-button">
              {busy ? (
                <LoaderCircle className="spin" size={17} />
              ) : (
                <KeyRound size={17} />
              )}
              {busy ? "กำลังบันทึก" : "บันทึกรหัสผ่านใหม่"}
            </button>
          </fieldset>
          <Link className="text-link" href="/forgot-password">
            ลิงก์หมดอายุหรือใช้แล้ว ขอลิงก์ใหม่
          </Link>
        </form>
      )}
    </RecoveryLayout>
  );
}

type RecoveryRequest = {
  id: string;
  email: string;
  displayName: string;
  status: string;
  requestedAt: string;
  expiresAt: string;
  requiresEditor: boolean;
};
type RecoveryLink = { resetUrl: string; email: string; expiresAt: string };
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("th-TH", {
        timeZone: "Asia/Bangkok",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";
}

export function RecoveryAdmin() {
  const [items, setItems] = useState<RecoveryRequest[]>([]);
  const [verified, setVerified] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState<RecoveryLink | null>(null);
  const [copied, setCopied] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setVerified([]);
    memberApi<{ items: RecoveryRequest[] }>("recoveryRequests")
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch((error) => {
        if (active)
          setError(
            error instanceof Error ? error.message : "โหลดคำขอไม่สำเร็จ",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);
  return (
    <section className="editor-section">
      <div className="panel-heading">
        <h2>คำขอตั้งรหัสใหม่</h2>
        <button
          className="icon-button"
          type="button"
          title="โหลดคำขอตั้งรหัสใหม่"
          aria-label="โหลดคำขอตั้งรหัสใหม่"
          disabled={busy || loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RotateCcw size={17} />
        </button>
      </div>
      {error && (
        <div className="studio-alert" role="alert">
          {error}
        </div>
      )}
      {link && (
        <div className="recovery-link" role="status">
          <strong>{link.email}</strong>
          <span>ลิงก์ใช้ได้ครั้งเดียว หมดอายุ {dateLabel(link.expiresAt)}</span>
          <div className="recovery-link-row">
            <input
              aria-label="ลิงก์ส่วนตัวสำหรับตั้งรหัสใหม่"
              value={link.resetUrl}
              readOnly
            />
            <button
              type="button"
              className="icon-button"
              title="คัดลอกลิงก์ส่วนตัว"
              aria-label="คัดลอกลิงก์ส่วนตัว"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link.resetUrl);
                  setCopied(true);
                } catch {
                  setError("คัดลอกไม่สำเร็จ กรุณาเลือกลิงก์ในช่องแล้วคัดลอก");
                }
              }}
            >
              <Copy size={17} />
            </button>
          </div>
          {copied && <span>คัดลอกแล้ว</span>}
        </div>
      )}
      {loading ? (
        <p className="muted">กำลังโหลดคำขอ</p>
      ) : !error && !items.length ? (
        <p className="muted">ไม่มีคำขอตั้งรหัสใหม่</p>
      ) : (
        <ul className="member-request-list recovery-request-list">
          {items.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.displayName}</strong>
                <span>{item.email}</span>
                <span>
                  {dateLabel(item.requestedAt)} ·{" "}
                  {item.status === "PENDING" ? "รอยืนยันตัวตน" : "ออกลิงก์แล้ว"}
                </span>
                {item.requiresEditor ? (
                  <p>
                    บัญชีผู้ดูแลสูงสุด ใช้ Google Apps Script ของเจ้าของบัญชี
                  </p>
                ) : (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={verified.includes(item.id)}
                      disabled={busy}
                      onChange={(event) =>
                        setVerified((previous) =>
                          event.target.checked
                            ? [...previous, item.id]
                            : previous.filter((id) => id !== item.id),
                        )
                      }
                    />
                    ยืนยันตัวตนเจ้าของบัญชีแล้ว
                  </label>
                )}
              </div>
              {!item.requiresEditor && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || !verified.includes(item.id)}
                  onClick={async () => {
                    if (
                      item.status === "ISSUED" &&
                      !window.confirm(
                        "ออกลิงก์ใหม่จะยกเลิกลิงก์เดิม ดำเนินการหรือไม่?",
                      )
                    )
                      return;
                    setBusy(true);
                    setError("");
                    setLink(null);
                    setCopied(false);
                    try {
                      setLink(
                        await memberApi<RecoveryLink>("issuePasswordReset", {
                          requestId: item.id,
                          identityVerified: true,
                        }),
                      );
                      setRefresh((value) => value + 1);
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "ออกลิงก์ไม่สำเร็จ",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <KeyRound size={17} />
                  {item.status === "ISSUED"
                    ? "ออกลิงก์ใหม่"
                    : "ออกลิงก์ส่วนตัว"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
