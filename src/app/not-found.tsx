export default function NotFoundPage() {
  return (
    <main className="main-shell" style={{ display: "grid", placeItems: "center", minHeight: "100dvh", paddingBottom: 24 }}>
      <section className="glass-card" style={{ width: "min(560px, 100%)", padding: 20, textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", letterSpacing: ".08em" }}>WE S D A U</p>
        <h1 style={{ margin: "8px 0 6px", fontSize: 28 }}>404</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>页面不存在或已被移动。</p>
      </section>
    </main>
  );
}
