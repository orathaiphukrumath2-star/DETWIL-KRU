# DETWIL-KRU

DETWIL: ระบบนิเวศดิจิทัลเพื่อพัฒนาผลงานครูและนวัตกรรมการเรียนรู้

โครงนี้เริ่มจาก Phase 1 Foundation ตามแนวทาง Hybrid:

- `apps-script/` สำหรับ Google Apps Script, Google Sheets, Google Drive, setup, repository, audit, error และ password hash
- `web/` สำหรับ Vercel/Next.js frontend
- `docs/` สำหรับคู่มือและ handoff

## สถานะปัจจุบัน

โค้ดชุดนี้เป็น Phase 1 Foundation สำหรับนำขึ้น GitHub และ Vercel มี dashboard และ `/api/health` ที่ตรวจ Google Apps Script, Google Sheets, Google Drive และ schema

ตรวจ Apps Script deployment ของเจ้าของระบบวันที่ 14 ตุลาคม 2569: Spreadsheet, Drive root และ schema ตอบกลับผ่าน การตรวจนี้ไม่ใช่การตรวจจำนวนหรือความครบถ้วนของข้อมูลในชีต

ระบบเข้าสู่ระบบบนเว็บ, ส่งผลงาน, รับรองผลงาน, เว็บไซต์ครู และ Canvas Document Engine ยังต้องพัฒนาต่อก่อนเปิดให้ครูใช้งานจริง

## เริ่มเว็บใน VSCode

ใช้ Node.js 22 และเปิด Terminal ในโฟลเดอร์โปรเจกต์:

```powershell
cd web
npm ci
Copy-Item .env.local.example .env.local
```

หากมี `.env.local` อยู่แล้ว ให้ใช้ไฟล์เดิมและข้ามคำสั่ง Copy-Item เติม `APPS_SCRIPT_WEB_APP_URL` เป็น URL ลงท้าย `/exec` แล้วรัน:

```powershell
npm run dev
```

เปิด `http://localhost:3000` ตรวจด้วย `npm test`, `npm run build` และ `npm run typecheck`

## GitHub และ Vercel

ดู [คู่มือขึ้นออนไลน์](docs/github-vercel-th.md) ตั้ง Root Directory ใน Vercel เป็น `web` และเพิ่ม `APPS_SCRIPT_WEB_APP_URL` ใน Environment Variables ของ Vercel ค่านี้ใช้ฝั่ง server เท่านั้น

`.env.local`, credentials, `node_modules` และ `.next` ถูกละเว้นจาก Git ต้องไม่เพิ่มด้วย `git add -f` การ push ไป GitHub ไม่ได้อัปเดต Google Apps Script โดยอัตโนมัติ

## สิ่งที่ทำแล้ว

- สร้าง schema ของชีตหลักครบชุด
- เพิ่ม `AUTH_CREDENTIALS` สำหรับ password hash/salt
- เพิ่ม setup script สำหรับสร้าง spreadsheet, sheets, headers และ Drive folders
- เพิ่ม repository layer สำหรับอ่าน/เขียนชีตแบบรวมศูนย์
- เพิ่ม audit log, system error log และ backup พื้นฐาน
- สร้างหน้า dashboard เริ่มต้นสำหรับ Vercel/Next.js

## วิธีเดินต่อแบบจับมือทำ

1. เปิดโฟลเดอร์ `apps-script`
2. สร้างโปรเจกต์ Apps Script ใหม่
3. คัดลอกไฟล์ `.gs` และ `appsscript.json` เข้า Apps Script
4. Run ฟังก์ชัน `DETWIL_setupNewProject`
5. อนุญาตสิทธิ์ Google Sheets และ Drive
6. จด `spreadsheetId` และ `rootFolderId` ที่ระบบคืนกลับมา
7. เติม `APPS_SCRIPT_WEB_APP_URL` ลงใน `.env.local` ของฝั่ง `web`
8. เริ่มเชื่อม API จริงใน Phase 2

## หมายเหตุด้านรหัสผ่าน

ระบบนี้ไม่เก็บรหัสผ่านจริงในชีต แต่เก็บเฉพาะ `PasswordHash`, `PasswordSalt` และ `PasswordAlgorithm` ในชีต `AUTH_CREDENTIALS`

## ข้อมูลที่ยังต้องเติม

- อีเมล Super Admin
- รายชื่อและรหัส 31 โรงเรียน
- Google OAuth Client ID
- Apps Script Web App URL
- รูปแบบเลขที่เกียรติบัตร/เอกสารรับรอง
- ผู้ลงนาม ลายเซ็น และตราประทับ
- ขนาดไฟล์และชนิดไฟล์ที่อนุญาต
