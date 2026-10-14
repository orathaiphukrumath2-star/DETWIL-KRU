import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DETWIL | ผลงานครูและนวัตกรรมการเรียนรู้ สพม.หนองคาย",
  description: "ระบบนิเวศดิจิทัลเพื่อพัฒนาผลงานครูและนวัตกรรมการเรียนรู้ สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
