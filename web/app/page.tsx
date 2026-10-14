import { StatusBadge } from "@/components/StatusBadge";
import { getAppsScriptHealth } from "@/lib/appsScript";
import { detwilProject, foundationSteps, lockedDecisions, moduleMap } from "@/lib/detwil";
import { sheetCount } from "@/lib/schema";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const appsScript = await getAppsScriptHealth();
  const connectionTone = appsScript.ok ? "ready" : appsScript.configured ? "waiting" : "locked";
  const connectionLabel = appsScript.ok ? "เชื่อมแล้ว" : appsScript.configured ? "ตรวจอีกครั้ง" : "รอ URL";

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="เมนูหลัก">
        <div className="brand">
          <div className="brand-mark">D</div>
          <div>
            <strong>{detwilProject.shortName}</strong>
            <span>Phase 1</span>
          </div>
        </div>

        <nav className="nav-list">
          <a className="nav-link nav-link--active" href="#dashboard">Dashboard</a>
          <a className="nav-link" href="#foundation">Foundation</a>
          <a className="nav-link" href="#modules">Modules</a>
          <a className="nav-link" href="#sheets">Sheets</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย</p>
            <h1>DETWIL Control Center</h1>
          </div>
          <StatusBadge tone="ready">Phase 1 Foundation</StatusBadge>
        </header>

        <section id="dashboard" className="overview-band">
          <div className="overview-copy">
            <p>{detwilProject.nameTh}</p>
            <h2>โครงระบบพร้อมเริ่มเชื่อม Google Sheets และ Drive</h2>
          </div>
          <div className="metric-strip" aria-label="สถานะโครงระบบ">
            <div className="metric">
              <span>โรงเรียน</span>
              <strong>{detwilProject.schoolCount}</strong>
              <small>ยืนยันตามขอบเขตระบบ</small>
            </div>
            <div className="metric">
              <span>Sheet</span>
              <strong>{sheetCount}</strong>
              <small>เตรียม header ครบชุด</small>
            </div>
            <div className="metric">
              <span>ข้อมูลจริง</span>
              <strong>รอเติม</strong>
              <small>ไม่สร้างแทนผู้ใช้</small>
            </div>
          </div>
        </section>

        <section id="foundation" className="section-grid">
          <div className="panel">
            <div className="panel-header">
              <h2>Foundation</h2>
              <StatusBadge tone="ready">กำลังทำ</StatusBadge>
            </div>
            <ul className="check-list">
              {foundationSteps.map((step) => (
                <li key={step}>
                  <span className="check-dot" />
                  {step}
                </li>
              ))}
            </ul>
          </div>

          <div className="panel">
            <div className="panel-header">
              <h2>Locked Decisions</h2>
              <StatusBadge tone="locked">ยืนยันแล้ว</StatusBadge>
            </div>
            <div className="decision-list">
              {lockedDecisions.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          </div>

          <div className="panel connection-panel">
            <div className="panel-header">
              <h2>Apps Script Connection</h2>
              <StatusBadge tone={connectionTone}>{connectionLabel}</StatusBadge>
            </div>
            <dl className="connection-list">
              <div>
                <dt>Web App URL</dt>
                <dd>{appsScript.configured ? appsScript.urlHost || "ตั้งค่าแล้ว" : "ยังไม่ได้ใส่ใน .env.local"}</dd>
              </div>
              <div>
                <dt>Spreadsheet</dt>
                <dd>{appsScript.data?.spreadsheetConnected ? "เชื่อมแล้ว" : "รอตรวจ"}</dd>
              </div>
              <div>
                <dt>Drive Root</dt>
                <dd>{appsScript.data?.rootFolderConnected ? "เชื่อมแล้ว" : "รอตรวจ"}</dd>
              </div>
              <div>
                <dt>Schema</dt>
                <dd>{appsScript.data?.schemaOk ? "ผ่าน" : appsScript.error || "รอตรวจ"}</dd>
              </div>
            </dl>
            {appsScript.data?.schemaProblems?.length ? (
              <p className="connection-note">{appsScript.data.schemaProblems.slice(0, 2).join(", ")}</p>
            ) : (
              <p className="connection-note">{appsScript.error || "Google Sheets และ Drive พร้อมเชื่อมต่อ"}</p>
            )}
          </div>
        </section>

        <section id="modules" className="module-band">
          <div className="section-title">
            <h2>โมดูลหลัก</h2>
            <p>สถานะตั้งต้นก่อนเชื่อมข้อมูลจริงจากชีต</p>
          </div>
          <div className="module-grid">
            {moduleMap.map((module) => (
              <article className={`module-card module-card--${module.color}`} key={module.key}>
                <div className="module-token" />
                <h3>{module.title}</h3>
                <p>{module.status}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="sheets" className="table-band">
          <div className="section-title">
            <h2>ข้อมูลที่ยังต้องเติม</h2>
            <p>ใช้ placeholder จนกว่าจะได้รับข้อมูลจริง</p>
          </div>
          <div className="placeholder-table" role="table" aria-label="รายการข้อมูลที่ยังต้องเติม">
            <div role="row">
              <strong role="cell">Spreadsheet ID</strong>
              <span role="cell">[โปรดเติมข้อมูลจริง: Spreadsheet ID]</span>
            </div>
            <div role="row">
              <strong role="cell">Root Folder ID</strong>
              <span role="cell">[โปรดเติมข้อมูลจริง: Root Folder ID]</span>
            </div>
            <div role="row">
              <strong role="cell">รายชื่อโรงเรียน</strong>
              <span role="cell">[โปรดเติมข้อมูลจริง: รายชื่อและรหัส 31 โรงเรียน]</span>
            </div>
            <div role="row">
              <strong role="cell">ผู้ดูแลเริ่มต้น</strong>
              <span role="cell">[โปรดเติมข้อมูลจริง: อีเมล Super Admin]</span>
            </div>
          </div>
        </section>
      </section>
    </main>
  );
}
