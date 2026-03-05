import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="main-shell" style={{ display: "grid", alignItems: "center" }}>
      <div>
        <LoginForm />
      </div>
    </main>
  );
}
