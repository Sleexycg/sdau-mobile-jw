import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "山农教务移动版",
  description: "SDAU 手机教务课表系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}