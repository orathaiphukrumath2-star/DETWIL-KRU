"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  KeyRound,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import {
  roleLabels,
  roleStatusLabels,
  type Identity,
  type RoleRequest,
  type School,
} from "@/lib/works";
import {
  memberApi,
  MemberApiError,
  membershipOptionsUrl,
} from "@/lib/workClient";

const requestableRoles = [
  "TEACHER",
  "SCHOOL_ADMIN",
  "SUPERVISOR",
  "AREA_ADMIN",
];
type Options = { schools: School[]; roles: string[] };
function needsSchool(role: string) {
  return role === "TEACHER" || role === "SCHOOL_ADMIN";
}

function RolePicker({
  schools,
  onChange,
  loading = false,
}: {
  schools: School[];
  onChange: (requests: RoleRequest[]) => void;
  loading?: boolean;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [schoolId, setSchoolId] = useState("");
  function update(next: string[], school: string) {
    setChosen(next);
    setSchoolId(school);
    onChange(
      next.map((role) => ({ role, schoolId: needsSchool(role) ? school : "" })),
    );
  }
  return (
    <div className="role-picker">
      <span className="field-label">บทบาทที่ขอ</span>
      <div className="role-choice-grid">
        {requestableRoles.map((role) => (
          <label className="checkbox-label" key={role}>
            <input
              type="checkbox"
              checked={chosen.includes(role)}
              onChange={(e) =>
                update(
                  e.target.checked
                    ? [...chosen, role]
                    : chosen.filter((r) => r !== role),
                  schoolId,
                )
              }
            />
            {roleLabels[role]}
          </label>
        ))}
      </div>
      {chosen.some(needsSchool) && (
        <label>
          สถานศึกษาสำหรับบทบาทโรงเรียน
          <select
            value={schoolId}
            required
            onChange={(e) => update(chosen, e.target.value)}
          >
            <option value="">เลือกสถานศึกษา</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {!schools.length && (
        <p className="muted">
          {loading
            ? "กำลังโหลดรายชื่อสถานศึกษา"
            : "ยังไม่มีรายชื่อโรงเรียนที่เปิดใช้งาน กรุณาติดต่อผู้ดูแลเพิ่มสถานศึกษา"}
        </p>
      )}
    </div>
  );
}

export function Registration() {
  const [options, setOptions] = useState<Options>({ schools: [], roles: [] });
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [retry, setRetry] = useState(0);
  const [accountExists, setAccountExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setOptionsError("");
    fetch(membershipOptionsUrl, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.ok)
          throw new Error(
            body?.error?.message || "โหลดข้อมูลสมัครสมาชิกไม่สำเร็จ",
          );
        setOptions(body.data);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setOptionsError(
            e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <Link href="/" className="studio-brand">
          DETWIL<span>สมาชิกและผลงานครู</span>
        </Link>
        <Link className="text-link" href="/studio">
          <ArrowLeft size={17} />
          เข้าสู่ระบบ
        </Link>
      </header>
      <main className="studio-container registration-container">
        <div className="registration-brand">
          <img
            src="/images/agency-logos.png"
            width={180}
            height={101}
            alt="ตราหน่วยงาน สพม.หนองคาย"
          />
          <div>
            <span className="section-kicker">DETWIL MEMBERSHIP</span>
            <h1>สมัครสมาชิก</h1>
          </div>
        </div>
        {error && (
          <div role="alert" className="studio-alert">
            {error}
            {accountExists && (
              <p>
                <Link className="text-link" href="/studio">
                  เข้าสู่ระบบบัญชีเดิม
                </Link>
                {
                  " · หากผู้ดูแลยังไม่ได้ตั้งรหัสผ่าน ให้เปิด Apps Script แล้วเรียกใช้ DETWIL_prepareWorkSystem"
                }
              </p>
            )}
          </div>
        )}
        {optionsError && (
          <div role="alert" className="studio-alert">
            {optionsError}
            <button
              type="button"
              className="secondary-button"
              onClick={() => setRetry((value) => value + 1)}
            >
              <RotateCcw size={17} /> ลองใหม่
            </button>
          </div>
        )}
        {done ? (
          <section className="registration-success">
            <CheckCheck size={38} />
            <h2>สมัครสมาชิกแล้ว</h2>
            <p>
              บัญชีและคำขอบทบาทรอผู้ดูแลยืนยัน เข้าสู่ระบบเพื่อติดตามสถานะได้
            </p>
            <Link className="primary-button" href="/studio">
              <KeyRound size={17} />
              เข้าสู่ระบบ
            </Link>
          </section>
        ) : (
          <form
            className="registration-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const data = new FormData(form);
              setError("");
              setAccountExists(false);
              if (
                requests.some(
                  (request) => needsSchool(request.role) && !request.schoolId,
                )
              ) {
                setError(
                  "กรุณาเลือกสถานศึกษาสำหรับบทบาทครูและผู้ตรวจระดับโรงเรียน",
                );
                return;
              }
              if (data.get("password") !== data.get("confirm")) {
                setError("รหัสผ่านไม่ตรงกัน");
                return;
              }
              setBusy(true);
              try {
                await memberApi("register", {
                  displayName: data.get("name"),
                  email: data.get("email"),
                  password: data.get("password"),
                  website: data.get("website"),
                  roles: requests,
                });
                form.reset();
                setDone(true);
              } catch (e) {
                setAccountExists(
                  e instanceof MemberApiError && e.code === "ACCOUNT_EXISTS",
                );
                setError(
                  e instanceof Error ? e.message : "สมัครสมาชิกไม่สำเร็จ",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            <fieldset disabled={busy}>
              <div className="form-grid">
                <label>
                  ชื่อ-สกุล
                  <input
                    name="name"
                    required
                    maxLength={150}
                    autoComplete="name"
                  />
                </label>
                <label>
                  อีเมล
                  <input
                    name="email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="username"
                  />
                </label>
                <label>
                  รหัสผ่าน (12–128 ตัวอักษร)
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
                  ยืนยันรหัสผ่าน
                  <input
                    name="confirm"
                    type="password"
                    required
                    minLength={12}
                    maxLength={128}
                    autoComplete="new-password"
                  />
                </label>
              </div>
              <div className="registration-honeypot" aria-hidden="true">
                <label>
                  เว็บไซต์ส่วนตัว
                  <input name="website" tabIndex={-1} autoComplete="off" />
                </label>
              </div>
              <RolePicker
                schools={options.schools}
                onChange={setRequests}
                loading={loading}
              />
              <div className="registration-footer">
                <span className="approval-badge">
                  <ShieldCheck size={15} />
                  รอผู้ดูแลอนุมัติสิทธิ์
                </span>
                <button
                  className="primary-button"
                  disabled={loading || Boolean(optionsError)}
                >
                  <UserPlus size={17} />
                  {busy ? "กำลังสมัคร" : loading ? "กำลังโหลด" : "สมัครสมาชิก"}
                </button>
              </div>
            </fieldset>
          </form>
        )}
      </main>
    </div>
  );
}

export function MemberProfile({
  user,
  onUser,
  onPasswordChanged,
  onError,
}: {
  user: Identity;
  onUser: (user: Identity) => void;
  onPasswordChanged: () => void;
  onError: (message: string) => void;
}) {
  const [schools, setSchools] = useState<School[]>([]);
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(membershipOptionsUrl, { signal: controller.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!body.ok)
          throw new Error(body?.error?.message || "โหลดสถานศึกษาไม่สำเร็จ");
        setSchools(body.data.schools);
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          onError(e instanceof Error ? e.message : "โหลดข้อมูลไม่สำเร็จ");
      });
    return () => controller.abort();
  }, []);
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setNotice("");
    try {
      await action();
    } catch (e) {
      onError(e instanceof Error ? e.message : "ไม่สามารถดำเนินการได้");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="membership-profile">
      <section className="editor-section">
        <div className="panel-heading">
          <h2>บทบาทของฉัน</h2>
          <button
            className="icon-button"
            title="ตรวจสถานะล่าสุด"
            aria-label="ตรวจสถานะสมาชิก"
            disabled={busy}
            onClick={() =>
              void perform(async () =>
                onUser(await memberApi<Identity>("session")),
              )
            }
          >
            <RotateCcw size={17} />
          </button>
        </div>
        <p className="muted">
          {user.email} ·{" "}
          {user.accountStatus === "PENDING"
            ? "รอยืนยันสมาชิก"
            : "สมาชิกที่เปิดใช้งาน"}
        </p>
        {user.roles.length ? (
          <ul className="member-role-list">
            {user.roles.map((r) => (
              <li key={r.id}>
                <ShieldCheck size={19} />
                <div>
                  <strong>{roleLabels[r.role] || r.role}</strong>
                  <span>{r.schoolName || "ระดับเขตพื้นที่"}</span>
                </div>
                <span className="approval-badge">
                  {r.status === "ACTIVE" && !r.usable
                    ? "หมดอายุ / ถูกระงับ"
                    : roleStatusLabels[r.status] || r.status}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>ยังไม่มีคำขอบทบาท</p>
        )}
      </section>
      <section className="editor-section">
        <h2>ขอบทบาทเพิ่มเติม</h2>
        <form
          className="role-request-form"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(async () => {
              onUser(
                await memberApi<Identity>("requestRoles", { roles: requests }),
              );
              setNotice("ส่งคำขอบทบาทแล้ว");
            });
          }}
        >
          <RolePicker schools={schools} onChange={setRequests} />
          <button
            className="primary-button"
            disabled={busy || !requests.length}
          >
            <Send size={17} />
            ส่งคำขอ
          </button>
        </form>
      </section>
      {notice && (
        <div className="studio-notice" role="status">
          {notice}
        </div>
      )}
      <section className="editor-section">
        <h2>เปลี่ยนรหัสผ่าน</h2>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            if (data.get("password") !== data.get("confirm")) {
              onError("รหัสผ่านไม่ตรงกัน");
              return;
            }
            void perform(async () => {
              await memberApi("changePassword", {
                email: user.email,
                currentPassword: data.get("current"),
                password: data.get("password"),
              });
              form.reset();
              onPasswordChanged();
            });
          }}
        >
          <label>
            รหัสผ่านเดิม
            <input
              name="current"
              type="password"
              required
              maxLength={128}
              autoComplete="current-password"
            />
          </label>
          <label>
            รหัสผ่านใหม่
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
          <button className="primary-button" disabled={busy}>
            <KeyRound size={17} />
            เปลี่ยนรหัสผ่าน
          </button>
        </form>
      </section>
    </div>
  );
}

export function MemberAdmin({
  users,
  schools,
  busy,
  onSubmit,
}: {
  users: Identity[];
  schools: School[];
  busy: boolean;
  onSubmit: (action: string, payload: unknown) => Promise<boolean>;
}) {
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [memberId, setMemberId] = useState("");
  const [resetUser, setResetUser] = useState("");
  const pending = users.flatMap((user) =>
    user.roles
      .filter((r) => r.status === "PENDING")
      .map((role) => ({ user, role })),
  );
  return (
    <div className="member-admin">
      <section className="editor-section">
        <h2>
          คำขอบทบาท <span className="approval-badge">{pending.length}</span>
        </h2>
        {pending.length ? (
          <ul className="member-request-list">
            {pending.map(({ user, role }) => (
              <li key={role.id}>
                <div>
                  <strong>{user.displayName}</strong>
                  <span>{user.email}</span>
                  <p>
                    {roleLabels[role.role]} ·{" "}
                    {role.schoolName || "ระดับเขตพื้นที่"}
                  </p>
                </div>
                <div className="member-request-actions">
                  <button
                    className="icon-button"
                    title="อนุมัติบทบาท"
                    aria-label={`อนุมัติ ${user.displayName} ${roleLabels[role.role]}`}
                    disabled={busy}
                    onClick={() =>
                      void onSubmit("roleDecision", {
                        roleId: role.id,
                        decision: "APPROVE",
                      })
                    }
                  >
                    <Check size={20} />
                  </button>
                  <button
                    className="icon-button danger-text"
                    title="ไม่อนุมัติบทบาท"
                    aria-label={`ไม่อนุมัติ ${user.displayName} ${roleLabels[role.role]}`}
                    disabled={busy}
                    onClick={() =>
                      void onSubmit("roleDecision", {
                        roleId: role.id,
                        decision: "REJECT",
                      })
                    }
                  >
                    <X size={20} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">ไม่มีคำขอรออนุมัติ</p>
        )}
      </section>
      <section className="editor-section">
        <h2>เพิ่มบทบาทให้สมาชิก</h2>
        <form
          className="role-request-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit("assignRoles", { userId: memberId, roles: requests });
          }}
        >
          <label>
            สมาชิก
            <select
              required
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
            >
              <option value="">เลือกสมาชิก</option>
              {users.map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.displayName} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <RolePicker schools={schools} onChange={setRequests} />
          <button
            className="primary-button"
            disabled={busy || !requests.length}
          >
            <Plus size={17} />
            เพิ่มบทบาท
          </button>
        </form>
      </section>
      <section className="editor-section">
        <h2>สิทธิ์ที่ใช้งานอยู่</h2>
        <ul className="member-request-list">
          {users.flatMap((u) =>
            u.roles
              .filter((r) => r.status === "ACTIVE")
              .map((r) => (
                <li key={r.id}>
                  <div>
                    <strong>{u.displayName}</strong>
                    <p>
                      {roleLabels[r.role]} · {r.schoolName || "ระดับเขตพื้นที่"}
                    </p>
                  </div>
                  {r.role !== "SUPER_ADMIN" && (
                    <button
                      className="icon-button danger-text"
                      title="ถอนสิทธิ์บทบาท"
                      aria-label={`ถอนสิทธิ์ ${u.displayName} ${roleLabels[r.role]}`}
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `ถอนสิทธิ์ ${roleLabels[r.role]} ของ ${u.displayName} หรือไม่?`,
                          )
                        )
                          void onSubmit("roleDecision", {
                            roleId: r.id,
                            decision: "REVOKE",
                          });
                      }}
                    >
                      <X size={18} />
                    </button>
                  )}
                </li>
              )),
          )}
        </ul>
      </section>
      <section className="editor-section">
        <h2>ตั้งรหัสผ่านชั่วคราวให้สมาชิก</h2>
        <form
          className="admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const user = users.find((u) => u.userId === resetUser);
            if (!user) return;
            void onSubmit("resetMemberPassword", {
              userId: user.userId,
              email: user.email,
              password: data.get("password"),
            }).then((ok) => {
              if (ok) form.reset();
            });
          }}
        >
          <label>
            สมาชิก
            <select
              required
              value={resetUser}
              onChange={(e) => setResetUser(e.target.value)}
            >
              <option value="">เลือกสมาชิก</option>
              {users
                .filter((u) => u.role !== "SUPER_ADMIN")
                .map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.displayName} ({u.email})
                  </option>
                ))}
            </select>
          </label>
          <label>
            รหัสผ่านชั่วคราว (12–128 ตัวอักษร)
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <button className="primary-button" disabled={busy}>
            <KeyRound size={17} />
            ตั้งรหัสผ่านชั่วคราว
          </button>
        </form>
      </section>
    </div>
  );
}
