type StatusBadgeProps = {
  children: React.ReactNode;
  tone?: "ready" | "waiting" | "locked";
};

export function StatusBadge({ children, tone = "waiting" }: StatusBadgeProps) {
  return <span className={`status-badge status-badge--${tone}`}>{children}</span>;
}
