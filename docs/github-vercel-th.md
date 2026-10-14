# DETWIL: GitHub ไป Vercel

## โค้ดชุดที่นำขึ้น

- `apps-script/`: backend สำหรับ Google Apps Script
- `web/`: Next.js dashboard และตัวตรวจการเชื่อมต่อ
- `docs/`: คู่มือ
- `.github/workflows/ci.yml`: ตรวจ tests, production build และ TypeScript เมื่อ push

โค้ดเป็น Phase 1 Foundation ยังไม่มีระบบส่งผลงานและเข้าสู่ระบบบนเว็บที่พร้อมใช้จริง ไม่มีข้อมูลครูหรือข้อมูลจาก Google Sheets อยู่ใน repository ชุดนี้

## 1. GitHub

ใช้บัญชีของเจ้าของโค้ด สร้าง repository แบบ Private ชื่อ `detwil-system` ไม่เพิ่ม README หรือ .gitignore จากหน้าเว็บหากใช้ Git repository ที่เตรียมไว้แล้ว

ใน Terminal ของ VSCode ที่โฟลเดอร์โปรเจกต์:

```powershell
git status
git remote -v
```

หากยังไม่มี `origin` ให้เพิ่ม URL จาก repository ของคุณ แล้ว push:

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/detwil-system.git
git push -u origin main
```

หากมี `origin` อยู่แล้ว ให้ตรวจว่าเป็น repository ที่ต้องการก่อน push อย่าใช้ force push

## 2. Vercel

1. ลงชื่อเข้า Vercel เลือก Add New > Project
2. เลือก Import Git Repository แล้วเลือก repository `detwil-system`
3. ตั้ง Framework Preset เป็น Next.js
4. ตั้ง Root Directory เป็น `web`
5. ใช้ Node.js 22.x, Install Command `npm ci`, Build Command `npm run build`
6. ใน Environment Variables เพิ่ม key `APPS_SCRIPT_WEB_APP_URL` และ value เป็น URL `/exec` เดิมของ Google Apps Script
7. ใช้ค่าดังกล่าวกับ Production และ Preview แล้วกด Deploy

`web/.env.local` ใช้เฉพาะในเครื่อง ไม่ได้ส่งขึ้น GitHub หรือ Vercel ให้ตั้งค่า Environment Variables บน Vercel แยกต่างหาก ไม่ต้องใส่ Service Account หรือ Private Key สำหรับการเชื่อมต่อแบบ Apps Script ที่ใช้อยู่

## 3. ตรวจหลัง deploy

เปิด URL ที่ Vercel คืนมา แล้วเปิด `/api/health` ของเว็บเดียวกัน ผลปกติคือ HTTP 200, `ok: true` และ `appsScript.ok: true` หาก backend ไม่พร้อม endpoint จะตอบ HTTP 503 พร้อมข้อความสาเหตุ หน้าเว็บยังเปิดเพื่อดูสถานะได้

หลังแก้ Environment Variables ต้อง deploy ใหม่จึงจะนำค่าไปใช้ การ build ผ่านอย่างเดียวไม่ได้ยืนยันว่า Google Apps Script เชื่อมต่อได้

## 4. แก้โค้ดในอนาคต

```powershell
git status
git add web apps-script docs README.md .gitignore .github
git diff --cached --stat
git commit -m "Describe the change"
git push
```

ตรวจรายการ staged ก่อน commit ทุกครั้ง เมื่อเชื่อม GitHub integration สำเร็จ Vercel จะ deploy การแก้เว็บจาก branch `main` อัตโนมัติ

## Google Apps Script เป็น deployment แยก

การ push ไม่เปลี่ยนสคริปต์บน Google ให้ใช้ `apps-script/` เป็น source หลักและอัปเดต deployment ของ Apps Script ต่างหาก หากใช้ installer แบบไฟล์เดียว ต้องรวมโค้ดชุดใหม่ก่อนอัปเดต อย่านำ installer เก่าทับโค้ดที่แก้แล้ว

โค้ดชุดนี้ปิด action `setup` ผ่าน HTTP ให้รัน `DETWIL_setupNewProject` จาก Editor เท่านั้น การแก้นี้มีผลกับ source ในชุด deploy และยังไม่เปลี่ยน Web App บน Google จนกว่าจะอัปเดต deployment

รหัสผ่านยังเก็บแบบ hash/salt ตามโครงเดิม ระบบยืนยันตัวตนและ session บนเว็บต้องพัฒนาต่อก่อนเปิดรับการเข้าสู่ระบบจริง

อ้างอิง: [Vercel Git deployments](https://vercel.com/docs/git), [Environment Variables](https://vercel.com/docs/environment-variables)
