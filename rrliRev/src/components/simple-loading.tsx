export interface SimpleLoadingProps {
  message?: string;
  compact?: boolean;
  className?: string;
}

export function SimpleLoading({
  message = "Loading…",
  compact = true,
  className = "",
}: SimpleLoadingProps) {
  return (
    <div
      className={`table-loading-container ${className}`.trim()}
      role="status"
      aria-label={message}
    >
      <div className={`neumorph-loading${compact ? " compact" : ""}`}>
        <div className="neumorph-glow-circle" aria-hidden="true" />
        <p className="neumorph-loading-text">{message}</p>
      </div>
    </div>
  );
}
