import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DETWIL",
  description: "Digital Ecosystem for Teacher Works and Learning Innovation",
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
