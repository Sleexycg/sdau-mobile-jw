import type { Metadata } from "next";

import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = {
  title: "WeSDAU",
};

export default function LoginPage() {
  return (
    <main className="main-shell login-shell">
      <div className="login-bg-layer" aria-hidden>
        <span className="login-orb login-orb-left" />
        <span className="login-orb login-orb-right" />
        <span className="login-mountain" />
        <span className="login-field-lines" />
      </div>

      <section className="login-hero rise-in">
        <p className="login-hero-tag">WeSDAU</p>
        <h1>山东农业大学综合教务系统</h1>
        <p>课表、成绩、空教室，一站式手机访问体验</p>
      </section>

      <section className="login-card-wrap rise-in">
        <LoginForm />
      </section>
    </main>
  );
}
