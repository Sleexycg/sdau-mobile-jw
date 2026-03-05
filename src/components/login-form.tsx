"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";

interface LoginResult {
  ok: boolean;
  code?: string;
  message?: string;
}

export function LoginForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, password }),
      });

      const result = (await response.json()) as LoginResult;
      if (!result.ok) {
        setError(result.message ?? "登录失败，请稍后重试");
        return;
      }

      router.replace("/timetable");
      router.refresh();
    } catch {
      setError("网络异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="glass-card rise-in" onSubmit={onSubmit} style={{ padding: 20 }}>
      <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 24 }}>登陆教务系统</h1>
      <p style={{ marginTop: 0, marginBottom: 16, color: "var(--muted)", fontSize: 14 }}>
        第三方移动端教务系统
      </p>

      <label htmlFor="student-id" style={{ fontSize: 13, color: "var(--muted)" }}>
        学号
      </label>
      <input
        id="student-id"
        value={studentId}
        onChange={(event) => setStudentId(event.target.value)}
        placeholder="请输入学号"
        autoComplete="username"
        style={inputStyle}
      />

      <label htmlFor="password" style={{ fontSize: 13, color: "var(--muted)" }}>
        密码
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="请输入密码"
        autoComplete="current-password"
        style={inputStyle}
      />

      {error ? <p className="error-text">{error}</p> : null}

      <button
        disabled={loading}
        style={{
          marginTop: 10,
          width: "100%",
          border: 0,
          borderRadius: 12,
          background: "linear-gradient(120deg, var(--primary), #16b5a3)",
          color: "white",
          fontSize: 16,
          fontWeight: 700,
          padding: "12px 16px",
        }}
      >
        {loading ? "登录中..." : "立即登录"}
      </button>
    </form>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  border: "1px solid #c9dde6",
  borderRadius: 12,
  marginTop: 6,
  marginBottom: 12,
  padding: "12px 14px",
  fontSize: 15,
  outline: "none",
  background: "#f8fdff",
};
