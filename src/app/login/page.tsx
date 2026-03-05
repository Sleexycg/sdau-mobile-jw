import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "山东农业大学综合教务系统移动端",
};

export default function LoginPage() {
  return (
    <main className="main-shell" style={{ display: "grid", alignItems: "center" }}>
      <div>
        <LoginForm />
      </div>
    </main>
  );
}
