"use client";

import Image from "next/image";
import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowRight, ArrowUpRight, Award, BadgeCheck, BookOpen, ChartColumn,
  CircleCheck, FileCheck2, FlaskConical, Globe2, GraduationCap,
  Images, LayoutDashboard, LibraryBig, Menu, MonitorPlay, RotateCcw,
  School, Search, ShieldCheck, Target, UsersRound, X, type LucideIcon,
} from "lucide-react";
import { detwilProject } from "@/lib/detwil";

const navigation = [
  { id: "overview", label: "หน้าหลัก", icon: LayoutDashboard },
  { id: "dashboard", label: "ภาพรวมผลงาน", icon: ChartColumn },
  { id: "works", label: "คลังผลงาน", icon: LibraryBig },
  { id: "schools", label: "สถานศึกษา", icon: School },
  { id: "objectives", label: "วัตถุประสงค์", icon: Target },
];

const workTypes = [
  { key: "media", label: "สื่อและนวัตกรรม", shortLabel: "สื่อ / นวัตกรรม", icon: Images, color: "teal" },
  { key: "lesson", label: "แผนการจัดการเรียนรู้", shortLabel: "แผนการเรียนรู้", icon: BookOpen, color: "violet" },
  { key: "obec", label: "OBEC Content Center", shortLabel: "OBEC", icon: MonitorPlay, color: "amber" },
  { key: "research", label: "งานวิจัยเพื่อพัฒนาการเรียนรู้", shortLabel: "งานวิจัย", icon: FlaskConical, color: "rose" },
];

const objectives = [
  { icon: BookOpen, title: "พัฒนาสื่อและนวัตกรรมการเรียนรู้", text: "ส่งเสริมการสร้างและใช้สื่อ แผนการจัดการเรียนรู้ และ OBEC Content Center เพื่อพัฒนาคุณภาพผู้เรียน", color: "teal" },
  { icon: FlaskConical, title: "ส่งเสริมการวิจัยของครู", text: "สนับสนุนการวิจัยเพื่อแก้ปัญหาและพัฒนาการจัดการเรียนรู้ เชื่อมโยงองค์ความรู้สู่การปฏิบัติในชั้นเรียน", color: "rose" },
  { icon: ShieldCheck, title: "สร้างคลังผลงานที่มีคุณภาพ", text: "รวบรวม ตรวจสอบ และรับรองผลงานจากระดับครู สถานศึกษา สู่คลังระดับเขตพื้นที่การศึกษา", color: "blue" },
  { icon: ChartColumn, title: "ติดตามและต่อยอดการพัฒนา", text: "ใช้ข้อมูลร่วมกันในการนิเทศ ติดตาม รายงานผล และเผยแพร่แนวปฏิบัติที่ดีของสถานศึกษา", color: "amber" },
];

function AgencyLogo() {
  return <div className="agency-logo-frame">
    <Image src="/images/agency-logos.png" alt="ตราสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย และกลุ่มนิเทศ ติดตามและประเมินผลการจัดการศึกษา"
      width={196} height={110} sizes="196px" priority className="agency-logos" />
  </div>;
}

function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return <div className="empty-state"><div className="empty-state-icon"><Icon size={27} strokeWidth={1.5} aria-hidden="true" /></div>
    <strong>{title}</strong>{detail && <p>{detail}</p>}
  </div>;
}

export function Dashboard({ connectionStatus }: { connectionStatus: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("overview");
  const [academicYear, setAcademicYear] = useState("all");
  const [workType, setWorkType] = useState("all");
  const [search, setSearch] = useState("");
  const periodLabel = academicYear === "all" ? "ทุกปีการศึกษา" : `ปีการศึกษา ${academicYear}`;
  const filtered = workType !== "all" || search.trim() !== "";

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting)
        .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
      if (visible) setActiveSection(visible.target.id);
    }, { rootMargin: "-8% 0px -65% 0px" });
    for (const { id } of navigation) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 761px)");
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  function selectWorkType(key: string) {
    setWorkType(key);
    setActiveSection("works");
    document.getElementById("works")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหา</a>
    {menuOpen && <button className="sidebar-backdrop" aria-label="ปิดเมนูหลัก" onClick={() => setMenuOpen(false)} />}
    <aside id="main-navigation" className={`sidebar ${menuOpen ? "sidebar--open" : ""}`} aria-label="เมนูหลัก">
      <button className="icon-button sidebar-close" aria-label="ปิดเมนู" title="ปิดเมนู" onClick={() => setMenuOpen(false)}><X size={19} /></button>
      <div className="sidebar-brand"><AgencyLogo /><a className="brand-name" href="#overview" onClick={() => setMenuOpen(false)}>DETWIL<span>ผลงานครูและนวัตกรรมการเรียนรู้</span></a></div>
      <p className="nav-caption">พื้นที่การเรียนรู้ร่วมกัน</p>
      <nav className="nav-list">{navigation.map(({ id, label, icon: Icon }) =>
        <a key={id} href={`#${id}`} className={`nav-link ${activeSection === id ? "nav-link--active" : ""}`}
          aria-current={activeSection === id ? "location" : undefined} onClick={() => { setActiveSection(id); setMenuOpen(false); }}>
          <Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>{activeSection === id && <span className="nav-indicator" />}
        </a>)}
      </nav>
      <div className="sidebar-agency"><GraduationCap size={24} strokeWidth={1.6} aria-hidden="true" /><strong>สพม.หนองคาย</strong>
        <p>กลุ่มนิเทศ ติดตามและประเมินผล<br />การจัดการศึกษา</p><span>เชื่อมโยงผลงาน สร้างคุณภาพการเรียนรู้</span>
      </div>
    </aside>

    <div className="workspace">
      <header className="topbar"><div className="topbar-leading">
        <button className="icon-button mobile-menu" title={menuOpen ? "ปิดเมนู" : "เปิดเมนู"} aria-label={menuOpen ? "ปิดเมนู" : "เปิดเมนู"}
          aria-expanded={menuOpen} aria-controls="main-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        <span className="topbar-title">ภาพรวมการพัฒนาผลงานครู</span>
      </div><div className="public-view"><Globe2 size={15} aria-hidden="true" /><span>ข้อมูลสาธารณะ</span></div><div className="mobile-agency-logo"><AgencyLogo /></div></header>

      <main id="main-content" className="main-content">
        <section id="overview" className="system-intro" aria-labelledby="system-name"><div className="intro-copy">
          <div className="intro-eyebrow"><span />สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย</div>
          <h1 id="system-name">DETWIL<span className="brand-period">.</span></h1>
          <h2>ระบบนิเวศดิจิทัลเพื่อพัฒนาผลงานครู<br className="desktop-break" />และนวัตกรรมการเรียนรู้</h2>
          <p className="english-name">{detwilProject.nameEn}</p>
        </div><div className="intro-context"><span className="context-label">จากห้องเรียน สู่การเรียนรู้ร่วมกัน</span>
          <p>เชื่อมโยงผลงานครู คลังสถานศึกษา<br className="desktop-break" />และคลังระดับเขตพื้นที่ เพื่อพัฒนาคุณภาพการศึกษา</p>
          <a href="#objectives" className="text-link">วัตถุประสงค์ของระบบ<ArrowUpRight size={17} aria-hidden="true" /></a>
        </div></section>

        <section id="dashboard" className="dashboard-section" aria-labelledby="dashboard-title">
          <div className="section-heading"><div><span className="section-kicker">DASHBOARD</span><h2 id="dashboard-title">ภาพรวมผลงานและการมีส่วนร่วม</h2></div>
            <label className="year-select"><span>ปีการศึกษา</span><select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} aria-label="เลือกปีการศึกษา">
              <option value="all">ทุกปีการศึกษา</option><option value="2569">2569</option><option value="2568">2568</option><option value="2567">2567</option>
            </select></label>
          </div>
          <div className="metric-grid">{[
            { label: "สถานศึกษาในสังกัด", value: "31", unit: "โรงเรียน", detail: "ขอบเขตการดำเนินงานของระบบ", icon: School, color: "teal" },
            { label: "ครูและบุคลากร", value: null, unit: "คน", detail: "รอข้อมูลบุคลากร", icon: UsersRound, color: "blue" },
            { label: "ผลงานในระบบ", value: null, unit: "ผลงาน", detail: "รอข้อมูลผลงาน", icon: LibraryBig, color: "violet" },
            { label: "ผลงานรับรองแล้ว", value: null, unit: "ผลงาน", detail: "รอข้อมูลการรับรอง", icon: BadgeCheck, color: "amber" },
          ].map(({ label, value, unit, detail, icon: Icon, color }) => <article key={label} className={`metric-card tone-${color}`}>
            <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={20} strokeWidth={1.7} aria-hidden="true" /></span></div>
            <div className="metric-value"><strong>{value ?? <span aria-label="ยังไม่มีข้อมูล">&mdash;</span>}</strong><span>{unit}</span></div><p>{detail}</p>
          </article>)}</div>

          <div className="analytics-band"><section className="distribution-view" aria-labelledby="distribution-title">
            <div className="panel-heading"><h3 id="distribution-title">ผลงานแยกตามประเภท</h3><span className="period-label">{periodLabel}</span></div>
            <div className="chart-empty" role="img" aria-label="กราฟผลงานแยกตามประเภท ยังไม่มีข้อมูลสถิติ">
              <div className="chart-grid" aria-hidden="true"><i /><i /><i /><i /></div>
              <div className="chart-empty-message"><ChartColumn size={25} strokeWidth={1.5} aria-hidden="true" /><strong>ยังไม่มีข้อมูลสถิติผลงาน</strong><span>{periodLabel}</span></div>
              <div className="chart-labels">{workTypes.map((item) => <span key={item.key}><i className={`legend-dot tone-${item.color}`} />{item.shortLabel}</span>)}</div>
            </div>
          </section><section className="workflow-view" aria-labelledby="workflow-title">
            <div className="panel-heading"><h3 id="workflow-title">เส้นทางการรับรองผลงาน</h3><ShieldCheck size={18} aria-hidden="true" /></div>
            <ol className="workflow-list">{[
              { title: "ผลงานครู", detail: "สร้างสรรค์และเผยแพร่", icon: BookOpen, color: "teal" },
              { title: "คลังสถานศึกษา", detail: "ตรวจสอบและรับรองโดยโรงเรียน", icon: School, color: "blue" },
              { title: "คลังระดับเขตพื้นที่", detail: "รับรองและเผยแพร่ระดับเขต", icon: Award, color: "amber" },
            ].map(({ title, detail, icon: Icon, color }) => <li key={title}><span className={`workflow-icon tone-${color}`}><Icon size={18} aria-hidden="true" /></span><div><strong>{title}</strong><span>{detail}</span></div><span className="workflow-value" aria-label="ยังไม่มีข้อมูล">&mdash;</span></li>)}</ol>
            <p className="quiet-note"><CircleCheck size={15} aria-hidden="true" />ยังไม่มีข้อมูลผลงานที่ผ่านการรับรอง</p>
          </section></div>
        </section>

        <section id="works" className="works-section" aria-labelledby="works-title">
          <div className="section-heading"><div><span className="section-kicker">LEARNING REPOSITORY</span><h2 id="works-title">คลังผลงานและนวัตกรรมการเรียนรู้</h2></div><span className="section-meta">{periodLabel}</span></div>
          <div className="work-type-list">{workTypes.map(({ key, label, icon: Icon, color }) => <button key={key} className={`work-type-button tone-${color} ${workType === key ? "work-type-button--selected" : ""}`} onClick={() => selectWorkType(key)} aria-pressed={workType === key}>
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span>{label}</span><ArrowUpRight size={15} className="work-type-arrow" aria-hidden="true" />
          </button>)}</div>
          <div className="repository-toolbar"><label className="search-field"><Search size={18} aria-hidden="true" /><input type="search" placeholder="ค้นหาชื่อผลงาน ครู หรือโรงเรียน" aria-label="ค้นหาผลงาน" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
            <select value={workType} onChange={(event) => setWorkType(event.target.value)} aria-label="กรองประเภทผลงาน"><option value="all">ผลงานทุกประเภท</option>{workTypes.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select>
            {filtered && <button className="icon-button" onClick={() => { setWorkType("all"); setSearch(""); }} aria-label="ล้างตัวกรองผลงาน" title="ล้างตัวกรองผลงาน"><RotateCcw size={18} /></button>}
          </div>
          <div className="repository-table-wrap"><table className="repository-table"><caption className="sr-only">รายการผลงานที่เผยแพร่</caption><thead><tr><th>ผลงาน / นวัตกรรม</th><th>ครูผู้จัดทำ</th><th>สถานศึกษา</th><th>การรับรอง</th></tr></thead><tbody><tr><td colSpan={4}>
            <div role="status" aria-live="polite"><EmptyState icon={filtered ? Search : LibraryBig} title={filtered ? "ไม่พบผลงานตามตัวกรอง" : "ยังไม่มีผลงานที่เผยแพร่"} detail={search.trim() ? `คำค้นหา: ${search.trim()}` : `${workType === "all" ? "ผลงานทุกประเภท" : workTypes.find((item) => item.key === workType)?.label} · ${periodLabel}`} /></div>
          </td></tr></tbody></table></div>
        </section>

        <section id="schools" className="schools-band" aria-labelledby="schools-title"><div className="school-heading-icon"><School size={25} strokeWidth={1.5} aria-hidden="true" /></div>
          <div className="schools-copy"><h2 id="schools-title">เครือข่ายสถานศึกษา</h2><p>สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย</p></div>
          <div className="school-scope"><strong>31</strong><span>โรงเรียนในสังกัด</span></div><span className="school-pending">รอข้อมูลรายชื่อสถานศึกษา</span>
        </section>

        <section id="objectives" className="objectives-section" aria-labelledby="objectives-title">
          <div className="section-heading"><div><span className="section-kicker">OUR PURPOSE</span><h2 id="objectives-title">วัตถุประสงค์ของระบบ</h2></div><span className="section-meta">เพื่อครู สถานศึกษา และคุณภาพผู้เรียน</span></div>
          <div className="objectives-grid">{objectives.map(({ icon: Icon, title, text, color }, index) => <article key={title} className="objective-item"><span className={`objective-icon tone-${color}`}><Icon size={22} strokeWidth={1.6} aria-hidden="true" /></span><div><span className="objective-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></div></article>)}</div>
          <div className="purpose-footer"><FileCheck2 size={17} aria-hidden="true" /><span>พัฒนาผลงานอย่างต่อเนื่อง เชื่อมโยงข้อมูลร่วมกัน และขยายผลสู่การเรียนรู้ที่มีคุณภาพ</span><ArrowRight size={18} aria-hidden="true" /></div>
        </section>
        <footer className="page-footer"><div><strong>DETWIL</strong><span>{detwilProject.ownerAgency}</span></div>{connectionStatus}</footer>
      </main>
    </div>
  </div>;
}
