"use client";

interface LoadingPanelProps {
  title: string;
  subtitle?: string;
  rows?: number;
}

export function LoadingPanel({ title, subtitle = "正在同步教务数据，请稍候...", rows = 5 }: LoadingPanelProps) {
  return (
    <section className="glass-card rise-in loading-panel">
      <div className="loading-panel-head">
        <span className="loading-dot" />
        <div>
          <p className="loading-title">{title}</p>
          <p className="loading-subtitle">{subtitle}</p>
        </div>
      </div>

      <div className="loading-skeleton-wrap">
        {Array.from({ length: rows }).map((_, idx) => (
          <div key={idx} className="loading-skeleton-row">
            <span className="loading-skeleton loading-skeleton-sm" />
            <span className="loading-skeleton loading-skeleton-lg" />
            <span className="loading-skeleton loading-skeleton-xs" />
          </div>
        ))}
      </div>
    </section>
  );
}
