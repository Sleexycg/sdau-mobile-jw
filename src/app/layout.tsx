import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "山东农业大学综合教务系统移动端",
  description: "第三方移动端教务系统",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
