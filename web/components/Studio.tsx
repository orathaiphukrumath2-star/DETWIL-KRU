"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Plus,
  Save,
  Send,
  Globe2,
  Eye,
  Copy,
  Trash2,
  Paperclip,
  LogOut,
  ShieldCheck,
  School as SchoolIcon,
  UsersRound,
  Check,
  RotateCcw,
  X,
  BookOpen,
  LoaderCircle,
  LockKeyhole,
} from "lucide-react";
import {
  approvalLabels,
  categoryLabels,
  typeLabels,
  type Attachment,
  type Identity,
  type School,
  type Work,
  type WorkContent,
  roleLabels,
} from "@/lib/works";
import { MemberAdmin, MemberProfile } from "@/components/Membership";
import { memberApi as api, MemberApiError } from "@/lib/workClient";

const blankContent = (): WorkContent => ({
  title: "",
  subject: "",
  gradeLevel: "",
  academicYear: String(new Date().getFullYear() + 543),
  workType: "lesson",
  description: "",
  objectives: "",
  results: "",
  authorName: "",
  schoolId: "",
  schoolName: "",
  attachments: [],
});
type ListData = { items: Work[]; total: number; schools: School[] };
type AdminData = { schools: School[]; users: Identity[] };

export function Studio() {
  const [user, setUser] = useState<Identity | null>(null);
  const [booting, setBooting] = useState(true);
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  const [bootAttempt, setBootAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("mine");
  const [list, setList] = useState<ListData>({
    items: [],
    total: 0,
    schools: [],
  });
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Work | null>(null);
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState<WorkContent>(blankContent);
  const [dirty, setDirty] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [source, setSource] = useState("link");
  const [category, setCategory] = useState("PLAN");
  const [comment, setComment] = useState("");
  const [admin, setAdmin] = useState<AdminData>({ schools: [], users: [] });

  async function loadList(queue = false, start = 0) {
    const data = await api<ListData>("myWorks", { queue, offset: start });
    setList(data);
  }
  async function openWork(id: string) {
    const data = await api<Work>("getWork", { id });
    setSelected(data);
    setContent(data.content);
    setEditing(true);
    setDirty(false);
    setComment("");
    setAttachmentOpen(false);
  }
  async function perform(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
    return false;
  }

  useEffect(() => {
    let active = true;
    let identified = false;
    setBooting(true);
    setSessionUnavailable(false);
    setError("");
    api<Identity>("session")
      .then(async (identity) => {
        if (!active) return;
        identified = true;
        setUser(identity);
        if (
          !identity.mustChangePassword &&
          identity.accountStatus === "ACTIVE" &&
          identity.activeRoleId
        ) {
          await loadList();
          const id = new URLSearchParams(window.location.search).get("id");
          if (id) await openWork(id);
        } else setTab("profile");
      })
      .catch((error) => {
        if (
          !active ||
          (!identified &&
            error instanceof MemberApiError &&
            error.code === "UNAUTHORIZED")
        )
          return;
        setError(
          error instanceof Error
            ? error.message
            : "ตรวจสอบการเข้าสู่ระบบไม่สำเร็จ",
        );
        setSessionUnavailable(!identified);
      })
      .finally(() => {
        if (active) setBooting(false);
      });
    return () => {
      active = false;
    };
  }, [bootAttempt]);

  function change<K extends keyof WorkContent>(key: K, value: WorkContent[K]) {
    setContent((previous) => ({ ...previous, [key]: value }));
    setDirty(true);
  }
  function leaveEditor() {
    if (
      dirty &&
      !window.confirm("ยังมีข้อมูลที่ไม่ได้บันทึก ออกจากผลงานนี้หรือไม่?")
    )
      return false;
    setEditing(false);
    setSelected(null);
    setDirty(false);
    setAttachmentOpen(false);
    return true;
  }
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await perform(async () => {
      const identity = await api<Identity>("passwordLogin", {
        email: data.get("email"),
        password: data.get("password"),
        remember: data.get("remember") === "on",
      });
      form.reset();
      setUser(identity);
      if (
        !identity.mustChangePassword &&
        identity.accountStatus === "ACTIVE" &&
        identity.activeRoleId
      ) {
        setTab("mine");
        await loadList();
        const id = new URLSearchParams(window.location.search).get("id");
        if (id) await openWork(id);
      } else setTab("profile");
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await perform(async () => {
      const result = await api<Work>("saveWork", {
        id: selected?.id,
        versionId: selected?.versionId,
        content,
      });
      setSelected(result);
      setContent(result.content);
      setDirty(false);
      setNotice("บันทึกฉบับร่างแล้ว");
      await loadList(tab === "queue", offset);
    });
  }
  async function command(action: string) {
    if (!selected || dirty) return;
    await perform(async () => {
      const result = await api<Work>("workflow", {
        id: selected.id,
        versionId: selected.versionId,
        command: action,
        comment,
      });
      setSelected(await api<Work>("getWork", { id: result.id }));
      setComment("");
      setNotice(
        action === "PUBLISH"
          ? "เผยแพร่แล้ว ลิงก์ผลงานเปิดได้โดยไม่ต้องเข้าสู่ระบบ"
          : "ปรับสถานะผลงานแล้ว",
      );
      await loadList(tab === "queue", offset);
    });
  }
  async function addAttachment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    await perform(async () => {
      const item: Attachment = {
        id: crypto.randomUUID(),
        category,
        title: String(data.get("title") || ""),
        url: "",
        fileId: "",
        isPublic: data.get("isPublic") === "on",
      };
      if (source === "file") {
        const file = data.get("file");
        if (!(file instanceof File) || !file.size || file.size > 2097152)
          throw new Error(
            "กรุณาเลือกไฟล์ขนาดไม่เกิน 2 MB หรือใช้ลิงก์ Google Drive แทน",
          );
        if (!selected) throw new Error("กรุณาบันทึกฉบับร่างก่อนเพิ่มไฟล์");
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1]);
          reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
          reader.readAsDataURL(file);
        });
        item.fileId = (
          await api<{ fileId: string }>("uploadFile", {
            id: selected.id,
            name: file.name,
            mime: file.type,
            base64,
          })
        ).fileId;
      } else {
        const url = new URL(String(data.get("url") || ""));
        if (url.protocol !== "https:" || url.username || url.password)
          throw new Error("กรุณาใช้ลิงก์ https:// ที่ไม่มีรหัสผ่านใน URL");
        item.url = url.href;
      }
      change("attachments", [...content.attachments, item]);
      form.reset();
      setAttachmentOpen(false);
      setNotice("เพิ่มหลักฐานแล้ว กรุณาบันทึกผลงาน");
    });
  }
  async function copyLink(preview: boolean) {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(
        `${location.origin}/works/${selected.id}${preview ? "?preview=1" : ""}`,
      );
      setNotice(
        preview
          ? "คัดลอกลิงก์ส่งตรวจแล้ว ผู้ตรวจต้องเข้าสู่ระบบ"
          : "คัดลอกลิงก์เผยแพร่แล้ว",
      );
    } catch {
      setError(
        "ไม่สามารถคัดลอกได้ กรุณาเปิดหน้าผลงานแล้วคัดลอก URL จากเบราว์เซอร์",
      );
    }
  }
  const owner = !selected || selected.ownerId === user?.userId;
  const pending = ["SCHOOL_PENDING", "DISTRICT_PENDING"].includes(
    selected?.approvalStatus || "",
  );
  const readonly = !owner || pending;
  async function updateMembership(action: string, payload: unknown) {
    return await perform(async () => {
      await api(action, payload);
      setAdmin(await api<AdminData>("adminData"));
      await loadList();
      setNotice("บันทึกข้อมูลสมาชิกแล้ว");
    });
  }

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <Link href="/" className="studio-brand">
          DETWIL<span>พื้นที่จัดการผลงาน</span>
        </Link>
        <div className="studio-account">
          {user && (
            <>
              <span>{user.displayName}</span>
              <label className="role-switcher">
                <span>บทบาทที่ใช้งาน</span>
                <select
                  aria-label="สลับบทบาท"
                  value={user.activeRoleId || ""}
                  disabled={busy || user.mustChangePassword}
                  onChange={(event) => {
                    const roleId = event.target.value;
                    if (!leaveEditor()) return;
                    void perform(async () => {
                      const identity = await api<Identity>("switchRole", {
                        roleId,
                      });
                      setUser(identity);
                      setTab("mine");
                      setOffset(0);
                      await loadList();
                    });
                  }}
                >
                  {!user.activeRoleId && (
                    <option value="">เลือกบทบาทที่อนุมัติแล้ว</option>
                  )}
                  {user.roles
                    ?.filter((role) => role.usable)
                    .map((role) => (
                      <option key={role.id} value={role.id}>
                        {roleLabels[role.role] || role.role}
                        {role.schoolName ? ` · ${role.schoolName}` : ""}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="icon-button"
                title="ออกจากระบบ"
                aria-label="ออกจากระบบ"
                disabled={busy}
                onClick={() => {
                  if (!leaveEditor()) return;
                  void perform(async () => {
                    await api("logout");
                    setUser(null);
                  });
                }}
              >
                <LogOut size={19} />
              </button>
            </>
          )}
          <Link href="/" className="text-link">
            <ArrowLeft size={16} />
            หน้าหลัก
          </Link>
        </div>
      </header>
      <main className="studio-container">
        {error && (
          <div className="studio-alert" role="alert">
            {error}
            <button
              className="icon-button"
              aria-label="ปิดข้อความผิดพลาด"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="studio-notice" role="status">
            <Check size={18} />
            {notice}
          </div>
        )}
        {booting ? (
          <div className="studio-empty">
            <LoaderCircle className="spin" size={26} />
            กำลังตรวจสอบการเข้าสู่ระบบ
          </div>
        ) : sessionUnavailable ? (
          <section className="studio-empty">
            <LockKeyhole size={28} />
            <h1>ยังตรวจสอบการเข้าสู่ระบบไม่สำเร็จ</h1>
            <button
              className="secondary-button"
              onClick={() => setBootAttempt((attempt) => attempt + 1)}
            >
              <RotateCcw size={17} /> ตรวจสอบอีกครั้ง
            </button>
            <Link href="/forgot-password" className="text-link">
              ลืมรหัสผ่าน
            </Link>
          </section>
        ) : !user ? (
          <div className="login-layout">
            <section className="login-intro">
              <img
                src="/images/agency-logos.png"
                alt="ตราหน่วยงาน สพม.หนองคาย"
                width="260"
                height="146"
              />
              <span className="section-kicker">TEACHING PORTFOLIO</span>
              <h1>ชุดผลงานการจัดการเรียนรู้</h1>
              <p>แผนการสอน · สื่อที่ใช้ตามแผน · ผลงานผู้เรียน</p>
              <div className="login-workflow">
                <BookOpen size={22} />
                <span>ครู</span>
                <span>→</span>
                <SchoolIcon size={22} />
                <span>โรงเรียน</span>
                <span>→</span>
                <ShieldCheck size={22} />
                <span>เขตพื้นที่</span>
              </div>
            </section>
            <form className="login-form" onSubmit={signIn}>
              <LockKeyhole size={25} />
              <h2>เข้าสู่ระบบ</h2>
              <label>
                อีเมล
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                รหัสผ่าน
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </label>
              <label className="checkbox-label">
                <input type="checkbox" name="remember" />
                จำการเข้าสู่ระบบ 30 วัน (อุปกรณ์ส่วนตัว)
              </label>
              <button className="primary-button" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="spin" size={18} />
                ) : (
                  <ArrowLeft size={18} />
                )}
                เข้าสู่ระบบ
              </button>
              <Link href="/register" className="secondary-button">
                <UsersRound size={17} />
                สมัครสมาชิก
              </Link>
              <Link className="text-link" href="/forgot-password">
                ลืมรหัสผ่าน
              </Link>
            </form>
          </div>
        ) : user.mustChangePassword ? (
          <form
            className="login-form password-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const values = new FormData(form);
              void perform(async () => {
                if (values.get("password") !== values.get("confirm"))
                  throw new Error("รหัสผ่านใหม่ไม่ตรงกัน");
                await api("changePassword", {
                  email: user.email,
                  currentPassword: values.get("current"),
                  password: values.get("password"),
                });
                form.reset();
                setUser(null);
                setNotice("เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่");
              });
            }}
          >
            <h1>ตั้งรหัสผ่านของคุณ</h1>
            <label>
              รหัสผ่านชั่วคราว
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <label>
              รหัสผ่านใหม่ (12–128 ตัวอักษร)
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <label>
              ยืนยันรหัสผ่าน
              <input
                name="confirm"
                type="password"
                autoComplete="new-password"
                required
                minLength={12}
                maxLength={128}
              />
            </label>
            <button className="primary-button" disabled={busy}>
              <Save size={17} />
              บันทึกรหัสผ่าน
            </button>
          </form>
        ) : user.accountStatus !== "ACTIVE" || !user.activeRoleId ? (
          <>
            <div className="studio-heading">
              <div>
                <span className="section-kicker">MEMBERSHIP</span>
                <h1>บัญชีและบทบาทของฉัน</h1>
              </div>
            </div>
            <div className="studio-notice">
              <ShieldCheck size={18} />
              เลือกบทบาทครูและสถานศึกษาเพื่อเริ่มจัดทำผลงาน
              สิทธิ์ผู้ตรวจรอยืนยันแยกต่างหาก
            </div>
            <MemberProfile
              user={user}
              onUser={setUser}
              onError={setError}
              onPasswordChanged={() => {
                setUser(null);
                setNotice("เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่");
              }}
            />
          </>
        ) : (
          <>
            <div className="studio-heading">
              <div>
                <span className="section-kicker">WORKSPACE</span>
                <h1>
                  {editing
                    ? owner
                      ? "จัดทำชุดผลงาน"
                      : "ตรวจชุดผลงาน"
                    : "ผลงานการจัดการเรียนรู้"}
                </h1>
              </div>
              {!editing && (
                <button
                  className="primary-button"
                  disabled={busy}
                  onClick={() => {
                    setSelected(null);
                    setContent({
                      ...blankContent(),
                      schoolId: user.schoolId || list.schools[0]?.id || "",
                    });
                    setEditing(true);
                    setDirty(false);
                  }}
                >
                  <Plus size={18} />
                  สร้างชุดผลงาน
                </button>
              )}
            </div>
            {!editing ? (
              <>
                <nav className="studio-tabs" aria-label="พื้นที่ทำงาน">
                  {[
                    { id: "mine", label: "ผลงานของฉัน", icon: BookOpen },
                    { id: "profile", label: "บัญชีและบทบาท", icon: UsersRound },
                    ...([
                      "SCHOOL_ADMIN",
                      "SUPER_ADMIN",
                      "AREA_ADMIN",
                      "SUPERVISOR",
                    ].includes(user.role)
                      ? [
                          {
                            id: "queue",
                            label: "รอตรวจรับรอง",
                            icon: ShieldCheck,
                          },
                        ]
                      : []),
                    ...(user.role === "SUPER_ADMIN"
                      ? [
                          {
                            id: "admin",
                            label: "โรงเรียนและบัญชีผู้ใช้",
                            icon: UsersRound,
                          },
                        ]
                      : []),
                  ].map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      className={tab === id ? "active" : ""}
                      disabled={busy}
                      aria-current={tab === id ? "page" : undefined}
                      onClick={() => {
                        setTab(id);
                        setOffset(0);
                        void perform(async () => {
                          if (id === "admin")
                            setAdmin(await api<AdminData>("adminData"));
                          else if (id !== "profile")
                            await loadList(id === "queue");
                        });
                      }}
                    >
                      <Icon size={17} />
                      {label}
                    </button>
                  ))}
                </nav>
                {tab === "admin" ? (
                  <>
                    <MemberAdmin
                      users={admin.users}
                      schools={admin.schools}
                      busy={busy}
                      onSubmit={updateMembership}
                    />
                    <AdminPanel
                      data={admin}
                      busy={busy}
                      onSubmit={async (action, payload) => {
                        return await perform(async () => {
                          await api(action, payload);
                          setAdmin(await api<AdminData>("adminData"));
                          await loadList();
                          setNotice("บันทึกข้อมูลแล้ว");
                        });
                      }}
                    />
                  </>
                ) : tab === "profile" ? (
                  <MemberProfile
                    user={user}
                    onUser={setUser}
                    onError={setError}
                    onPasswordChanged={() => {
                      setUser(null);
                      setNotice("เปลี่ยนรหัสผ่านแล้ว กรุณาเข้าสู่ระบบใหม่");
                    }}
                  />
                ) : (
                  <>
                    <div className="studio-list-heading">
                      <span>{list.total} ชุดผลงาน</span>
                      <button
                        className="icon-button"
                        title="โหลดรายการใหม่"
                        aria-label="โหลดรายการใหม่"
                        disabled={busy}
                        onClick={() =>
                          void perform(() => loadList(tab === "queue", offset))
                        }
                      >
                        <RotateCcw size={17} />
                      </button>
                    </div>
                    {list.items.length ? (
                      <div className="studio-work-list">
                        {list.items.map((work) => (
                          <button
                            className="studio-work-row"
                            key={work.id}
                            disabled={busy}
                            onClick={() =>
                              void perform(() => openWork(work.id))
                            }
                          >
                            <span className="row-work-icon">
                              <BookOpen size={22} />
                            </span>
                            <span className="row-work-main">
                              <strong>{work.content.title}</strong>
                              <span>
                                {work.content.subject} ·{" "}
                                {work.content.gradeLevel} ·{" "}
                                {work.content.authorName}
                              </span>
                            </span>
                            <span className="status-stack">
                              <span className="approval-badge">
                                {approvalLabels[work.approvalStatus]}
                              </span>
                              <small>
                                {work.isPublic ? "เผยแพร่แล้ว" : "ไม่เผยแพร่"}
                              </small>
                            </span>
                            <Eye size={18} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="studio-empty">
                        <BookOpen size={35} strokeWidth={1.3} />
                        <h2>
                          {tab === "queue"
                            ? "ไม่มีผลงานรอตรวจ"
                            : "ยังไม่มีชุดผลงาน"}
                        </h2>
                        {!list.schools.length && (
                          <p>
                            ยังไม่มีสถานศึกษาที่เปิดใช้งาน
                            กรุณาให้ผู้ดูแลเพิ่มข้อมูลโรงเรียน
                          </p>
                        )}
                      </div>
                    )}
                    {list.total > 30 && (
                      <div className="pagination">
                        <button
                          disabled={busy || offset === 0}
                          onClick={() => {
                            const next = Math.max(0, offset - 30);
                            setOffset(next);
                            void perform(() => loadList(tab === "queue", next));
                          }}
                        >
                          ก่อนหน้า
                        </button>
                        <span>
                          {Math.floor(offset / 30) + 1} /{" "}
                          {Math.ceil(list.total / 30)}
                        </span>
                        <button
                          disabled={busy || offset + 30 >= list.total}
                          onClick={() => {
                            const next = offset + 30;
                            setOffset(next);
                            void perform(() => loadList(tab === "queue", next));
                          }}
                        >
                          ถัดไป
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="editor-toolbar">
                  <button
                    className="text-link"
                    disabled={busy}
                    onClick={leaveEditor}
                  >
                    <ArrowLeft size={17} />
                    รายการผลงาน
                  </button>
                  <span className="approval-badge">
                    {selected
                      ? approvalLabels[selected.approvalStatus]
                      : "ชุดผลงานใหม่"}
                  </span>
                  <span className="save-state">
                    {dirty
                      ? "ยังไม่ได้บันทึก"
                      : selected
                        ? `บันทึกแล้ว · รุ่น ${selected.versionNo}`
                        : "ฉบับร่าง"}
                  </span>
                </div>
                <div className="editor-layout">
                  <div className="editor-main">
                    <form id="work-form" onSubmit={save}>
                      <fieldset disabled={busy || readonly}>
                        <section className="editor-section">
                          <h2>
                            <span className="section-number">01</span>
                            ข้อมูลชุดผลงาน
                          </h2>
                          <label>
                            ชื่อชุดผลงาน
                            <input
                              value={content.title}
                              onChange={(e) => change("title", e.target.value)}
                              required
                              maxLength={200}
                            />
                          </label>
                          <div className="form-grid">
                            <label>
                              รายวิชา
                              <input
                                value={content.subject}
                                onChange={(e) =>
                                  change("subject", e.target.value)
                                }
                                required
                                maxLength={100}
                              />
                            </label>
                            <label>
                              ระดับชั้น
                              <input
                                value={content.gradeLevel}
                                onChange={(e) =>
                                  change("gradeLevel", e.target.value)
                                }
                                required
                                maxLength={100}
                              />
                            </label>
                            <label>
                              ปีการศึกษา (พ.ศ.)
                              <input
                                value={content.academicYear}
                                onChange={(e) =>
                                  change("academicYear", e.target.value)
                                }
                                required
                                pattern="25[0-9]{2}"
                                inputMode="numeric"
                                maxLength={4}
                              />
                            </label>
                            <label>
                              ประเภทผลงาน
                              <select
                                value={content.workType}
                                onChange={(e) =>
                                  change("workType", e.target.value)
                                }
                              >
                                {Object.entries(typeLabels).map(
                                  ([key, label]) => (
                                    <option key={key} value={key}>
                                      {label}
                                    </option>
                                  ),
                                )}
                              </select>
                            </label>
                          </div>
                          <label>
                            สถานศึกษา
                            <select
                              required
                              disabled={Boolean(selected)}
                              value={content.schoolId}
                              onChange={(e) =>
                                change("schoolId", e.target.value)
                              }
                            >
                              <option value="">เลือกสถานศึกษา</option>
                              {list.schools.map((s) => (
                                <option value={s.id} key={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            ภาพรวมการจัดการเรียนรู้
                            <textarea
                              rows={4}
                              required
                              maxLength={4000}
                              value={content.description}
                              onChange={(e) =>
                                change("description", e.target.value)
                              }
                            />
                          </label>
                          <label>
                            วัตถุประสงค์การเรียนรู้
                            <textarea
                              rows={3}
                              maxLength={3000}
                              value={content.objectives}
                              onChange={(e) =>
                                change("objectives", e.target.value)
                              }
                            />
                          </label>
                        </section>
                        <section className="editor-section">
                          <h2>
                            <span className="section-number">02</span>แผน สื่อ
                            และหลักฐาน
                          </h2>
                          {Object.entries(categoryLabels).map(
                            ([key, label]) => (
                              <div className="attachment-group" key={key}>
                                <h3>
                                  {label}
                                  {["PLAN", "MEDIA"].includes(key) && (
                                    <span className="required-mark">
                                      จำเป็นก่อนส่งตรวจ
                                    </span>
                                  )}
                                </h3>
                                {content.attachments
                                  .filter((a) => a.category === key)
                                  .map((item) => (
                                    <div
                                      className="attachment-row"
                                      key={item.id}
                                    >
                                      <Paperclip size={17} />
                                      <div>
                                        <strong>{item.title}</strong>
                                        <span>
                                          {item.fileId ? "ไฟล์แนบ" : item.url}
                                        </span>
                                      </div>
                                      <label className="checkbox-label">
                                        <input
                                          type="checkbox"
                                          checked={item.isPublic}
                                          onChange={(e) =>
                                            change(
                                              "attachments",
                                              content.attachments.map((a) =>
                                                a.id === item.id
                                                  ? {
                                                      ...a,
                                                      isPublic:
                                                        e.target.checked,
                                                    }
                                                  : a,
                                              ),
                                            )
                                          }
                                        />
                                        เผยแพร่
                                      </label>
                                      {!readonly && (
                                        <button
                                          type="button"
                                          className="icon-button"
                                          aria-label={`ลบ ${item.title}`}
                                          title="ลบหลักฐาน"
                                          onClick={() =>
                                            change(
                                              "attachments",
                                              content.attachments.filter(
                                                (a) => a.id !== item.id,
                                              ),
                                            )
                                          }
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                {!content.attachments.some(
                                  (a) => a.category === key,
                                ) && <p className="muted">ยังไม่มีหลักฐาน</p>}
                              </div>
                            ),
                          )}
                          {!readonly && (
                            <button
                              type="button"
                              className="secondary-button"
                              disabled={content.attachments.length >= 20}
                              onClick={() => {
                                setAttachmentOpen(!attachmentOpen);
                                setSource("link");
                              }}
                            >
                              <Plus size={17} />
                              เพิ่มลิงก์หรือไฟล์
                            </button>
                          )}
                        </section>
                        <section className="editor-section">
                          <h2>
                            <span className="section-number">03</span>
                            ผลการจัดการเรียนรู้
                          </h2>
                          <label>
                            ผลที่เกิดกับผู้เรียน / บันทึกหลังสอน
                            <textarea
                              rows={5}
                              maxLength={3000}
                              value={content.results}
                              onChange={(e) =>
                                change("results", e.target.value)
                              }
                            />
                          </label>
                        </section>
                      </fieldset>
                    </form>
                    {attachmentOpen && !readonly && (
                      <form
                        className="attachment-form"
                        onSubmit={addAttachment}
                      >
                        <div className="panel-heading">
                          <h2>เพิ่มหลักฐาน</h2>
                          <button
                            type="button"
                            className="icon-button"
                            title="ปิด"
                            aria-label="ปิดแบบฟอร์มแนบหลักฐาน"
                            onClick={() => setAttachmentOpen(false)}
                          >
                            <X size={18} />
                          </button>
                        </div>
                        <div className="form-grid">
                          <label>
                            ประเภทหลักฐาน
                            <select
                              value={category}
                              onChange={(e) => setCategory(e.target.value)}
                            >
                              {Object.entries(categoryLabels).map(
                                ([key, label]) => (
                                  <option key={key} value={key}>
                                    {label}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <label>
                            ชื่อหลักฐาน
                            <input name="title" required maxLength={200} />
                          </label>
                        </div>
                        <div className="segmented-control">
                          <label>
                            <input
                              type="radio"
                              name="source"
                              value="link"
                              checked={source === "link"}
                              onChange={() => setSource("link")}
                            />
                            ลิงก์
                          </label>
                          <label>
                            <input
                              type="radio"
                              name="source"
                              value="file"
                              checked={source === "file"}
                              onChange={() => setSource("file")}
                              disabled={!selected}
                            />
                            ไฟล์ (ไม่เกิน 2 MB)
                          </label>
                        </div>
                        {source === "link" ? (
                          <label>
                            URL ของเอกสารหรือสื่อ
                            <input
                              name="url"
                              type="url"
                              required
                              placeholder="https://"
                              maxLength={2000}
                            />
                          </label>
                        ) : (
                          <label>
                            เลือกไฟล์
                            <input
                              name="file"
                              type="file"
                              required
                              accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.pptx"
                            />
                          </label>
                        )}
                        <label className="checkbox-label">
                          <input
                            name="isPublic"
                            type="checkbox"
                            key={category}
                            defaultChecked={
                              category === "PLAN" || category === "MEDIA"
                            }
                          />
                          อนุญาตเผยแพร่หลักฐานนี้สาธารณะ
                        </label>
                        <button className="primary-button" disabled={busy}>
                          <Paperclip size={17} />
                          เพิ่มหลักฐาน
                        </button>
                      </form>
                    )}
                    {selected?.history && selected.history.length > 0 && (
                      <section className="editor-section">
                        <h2>ประวัติการดำเนินงาน</h2>
                        <ol className="history-list">
                          {selected.history
                            .slice()
                            .reverse()
                            .map((h, i) => (
                              <li key={i}>
                                <strong>
                                  {(
                                    {
                                      SAVE: "บันทึกฉบับร่าง",
                                      PUBLISH: "เผยแพร่",
                                      UNPUBLISH: "ปิดการเผยแพร่",
                                      SUBMIT_SCHOOL: "ส่งโรงเรียนตรวจ",
                                      SUBMIT_DISTRICT: "ส่งเขตตรวจ",
                                      APPROVE: "รับรอง",
                                      RETURN: "ส่งกลับแก้ไข",
                                      REJECT: "ไม่รับรอง",
                                      WITHDRAW: "ถอนคำขอตรวจ",
                                    } as Record<string, string>
                                  )[h.action] || h.action}
                                </strong>
                                <span>
                                  {new Date(h.createdAt).toLocaleString(
                                    "th-TH",
                                  )}{" "}
                                  · {h.role}
                                </span>
                                {h.comment && <p>{h.comment}</p>}
                              </li>
                            ))}
                        </ol>
                      </section>
                    )}
                  </div>
                  <aside className="editor-actions">
                    <h2>สถานะและลิงก์ผลงาน</h2>
                    {selected && (
                      <>
                        <span className="approval-badge">
                          {approvalLabels[selected.approvalStatus]}
                        </span>
                        <p>
                          {selected.isPublic
                            ? "เผยแพร่สาธารณะแล้ว"
                            : "ยังไม่เผยแพร่สาธารณะ"}
                        </p>
                        {selected.isPublic &&
                          selected.publishedVersionId !==
                            selected.versionId && (
                            <p className="version-warning">
                              หน้าเผยแพร่ยังเป็นรุ่นก่อนหน้า
                            </p>
                          )}
                      </>
                    )}
                    {owner && (
                      <button
                        form="work-form"
                        className="primary-button"
                        disabled={busy || readonly}
                      >
                        <Save size={17} />
                        {busy ? "กำลังดำเนินการ" : "บันทึกฉบับร่าง"}
                      </button>
                    )}
                    {selected && (
                      <>
                        <a
                          className="secondary-button"
                          href={`/works/${selected.id}?preview=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Eye size={17} />
                          ดูฉบับบันทึกล่าสุด
                        </a>
                        <button
                          className="secondary-button"
                          onClick={() => void copyLink(true)}
                        >
                          <Copy size={17} />
                          คัดลอกลิงก์ส่งตรวจ
                        </button>
                        {owner && (
                          <>
                            <button
                              className="secondary-button"
                              disabled={
                                busy ||
                                dirty ||
                                selected.approvalStatus !== "DISTRICT_APPROVED"
                              }
                              title={
                                selected.approvalStatus === "DISTRICT_APPROVED"
                                  ? "เผยแพร่รุ่นที่โรงเรียนและเขตรับรองแล้ว"
                                  : "ต้องผ่านโรงเรียนและเขตก่อนเผยแพร่"
                              }
                              onClick={() => void command("PUBLISH")}
                            >
                              <Globe2 size={17} />
                              {selected.isPublic
                                ? "อัปเดตหน้าเผยแพร่"
                                : "เผยแพร่หน้าเว็บไซต์"}
                            </button>
                            {selected.approvalStatus !==
                              "DISTRICT_APPROVED" && (
                              <p className="muted">
                                รอรับรองจากโรงเรียนและเขตก่อนเผยแพร่สาธารณะ
                              </p>
                            )}
                            {selected.isPublic && (
                              <>
                                <a
                                  className="text-link"
                                  href={`/works/${selected.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <Eye size={17} />
                                  เปิดหน้าเผยแพร่
                                </a>
                                <button
                                  className="text-link"
                                  onClick={() => void copyLink(false)}
                                >
                                  <Copy size={17} />
                                  คัดลอกลิงก์สาธารณะ
                                </button>
                                <button
                                  className="text-link danger-text"
                                  disabled={busy || dirty}
                                  onClick={() => void command("UNPUBLISH")}
                                >
                                  ปิดการเผยแพร่
                                </button>
                              </>
                            )}
                            {["DRAFT", "RETURNED", "REJECTED"].includes(
                              selected.approvalStatus,
                            ) && (
                              <button
                                className="primary-button"
                                disabled={busy || dirty}
                                onClick={() => void command("SUBMIT_SCHOOL")}
                              >
                                <Send size={17} />
                                ส่งโรงเรียนตรวจ
                              </button>
                            )}
                            {selected.approvalStatus === "SCHOOL_APPROVED" && (
                              <button
                                className="primary-button"
                                disabled={busy || dirty}
                                onClick={() => void command("SUBMIT_DISTRICT")}
                              >
                                <Send size={17} />
                                ส่งเขตตรวจ
                              </button>
                            )}
                            {pending && (
                              <button
                                className="secondary-button"
                                disabled={busy}
                                onClick={() => void command("WITHDRAW")}
                              >
                                <RotateCcw size={17} />
                                ถอนคำขอตรวจ
                              </button>
                            )}
                          </>
                        )}
                        {!owner && pending && (
                          <div className="review-actions">
                            <label>
                              ความคิดเห็นผู้ตรวจ
                              <textarea
                                rows={4}
                                maxLength={2000}
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                              />
                            </label>
                            <button
                              className="primary-button"
                              disabled={busy}
                              onClick={() => void command("APPROVE")}
                            >
                              <Check size={17} />
                              รับรองผลงาน
                            </button>
                            <button
                              className="secondary-button"
                              disabled={busy || !comment.trim()}
                              onClick={() => void command("RETURN")}
                            >
                              <RotateCcw size={17} />
                              ส่งกลับแก้ไข
                            </button>
                            <button
                              className="text-link danger-text"
                              disabled={busy || !comment.trim()}
                              onClick={() => void command("REJECT")}
                            >
                              <X size={17} />
                              ไม่รับรอง
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </aside>
                </div>
              </>
            )}
          </>
        )}
      </main>
      <footer className="studio-footer">
        DETWIL · สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย
      </footer>
    </div>
  );
}

function AdminPanel({
  data,
  busy,
  onSubmit,
}: {
  data: AdminData;
  busy: boolean;
  onSubmit: (action: string, payload: unknown) => Promise<boolean>;
}) {
  const [role, setRole] = useState("TEACHER");
  return (
    <div className="admin-panel">
      <section className="editor-section">
        <h2>
          <SchoolIcon size={19} />
          สถานศึกษา
        </h2>
        <form
          className="admin-form"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = new FormData(form);
            void onSubmit("saveSchool", {
              code: values.get("code"),
              name: values.get("name"),
            }).then((ok) => {
              if (ok) form.reset();
            });
          }}
        >
          <label>
            รหัสโรงเรียน
            <input name="code" required maxLength={30} />
          </label>
          <label>
            ชื่อโรงเรียน
            <input name="name" required maxLength={200} />
          </label>
          <button className="primary-button" disabled={busy}>
            <Plus size={17} />
            เพิ่มโรงเรียน
          </button>
        </form>
        <ul className="admin-school-list">
          {data.schools.map((s) => (
            <li key={s.id}>
              <strong>{s.name}</strong>
              <span>{s.code}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="editor-section">
        <h2>
          <UsersRound size={19} />
          บัญชีผู้ใช้
        </h2>
        <form
          className="admin-form"
          autoComplete="off"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const values = new FormData(form);
            void onSubmit("createUser", {
              displayName: values.get("name"),
              email: values.get("email"),
              role,
              schoolId: values.get("schoolId"),
              password: values.get("password"),
            }).then((ok) => {
              if (ok) {
                (
                  form.elements.namedItem("password") as HTMLInputElement
                ).value = "";
              }
            });
          }}
        >
          <label>
            ชื่อ-สกุล
            <input name="name" required maxLength={150} />
          </label>
          <label>
            อีเมล
            <input name="email" type="email" required maxLength={254} />
          </label>
          <label>
            บทบาท
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="TEACHER">ครู</option>
              <option value="SCHOOL_ADMIN">ผู้ตรวจระดับโรงเรียน</option>
              <option value="SUPERVISOR">ศึกษานิเทศก์ / ผู้ตรวจระดับเขต</option>
              <option value="AREA_ADMIN">ผู้ดูแลระดับเขต</option>
            </select>
          </label>
          <label>
            สถานศึกษา
            <select
              name="schoolId"
              required={["TEACHER", "SCHOOL_ADMIN"].includes(role)}
            >
              <option value="">เลือกสถานศึกษา</option>
              {data.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
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
            <Plus size={17} />
            สร้างบัญชี
          </button>
        </form>
        <div className="admin-user-list">
          {data.users.map((u) => (
            <div key={u.userId}>
              <strong>{u.displayName}</strong>
              <span>{u.email}</span>
              <small>
                {(
                  {
                    SUPER_ADMIN: "ผู้ดูแลระบบ",
                    TEACHER: "ครู",
                    SCHOOL_ADMIN: "ผู้ตรวจโรงเรียน",
                    SUPERVISOR: "ศึกษานิเทศก์",
                    AREA_ADMIN: "ผู้ดูแลเขต",
                  } as Record<string, string>
                )[u.role] || u.role}
              </small>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
