"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

interface LoginResult {
  ok: boolean;
  code?: string;
  message?: string;
}

const LAST_LOGIN_KEY = "wesdau_last_login";

export function LoginForm() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LAST_LOGIN_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { studentId?: string; password?: string };
      if (typeof parsed.studentId === "string") setStudentId(parsed.studentId);
      if (typeof parsed.password === "string") setPassword(parsed.password);
    } catch {
      // ignore invalid local cache
    }
  }, []);

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

      try {
        window.localStorage.setItem(LAST_LOGIN_KEY, JSON.stringify({ studentId, password }));
      } catch {
        // ignore localStorage failure
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
    <form className="login-form glass-card" onSubmit={onSubmit}>
      <header className="login-form-header">
        <p className="login-form-subtitle">登录教务系统</p>
        <p className="login-form-desc">第三方移动端教务系统</p>
      </header>

      <label htmlFor="student-id" className="login-label">
        学号
      </label>
      <input
        id="student-id"
        value={studentId}
        onChange={(event) => setStudentId(event.target.value)}
        placeholder="请输入学号"
        autoComplete="username"
        className="login-input"
      />

      <label htmlFor="password" className="login-label">
        密码
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="请输入密码"
        autoComplete="current-password"
        className="login-input"
      />

      {error ? <p className="error-text">{error}</p> : null}

      <button disabled={loading} className="login-submit-btn">
        {loading ? "登录中..." : "进入系统"}
      </button>
    </form>
  );
}
