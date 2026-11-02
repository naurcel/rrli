export default function Loading() {
  return (
    <div className="content-wrap page-loading-container" role="status" aria-label="Loading page">
      <div className="page-loading-pill">
        <span className="page-loading-dot" />
        <span>Loading RouteX workspace…</span>
      </div>
      <div className="page-loading-skeleton" aria-hidden="true">
        <div className="skeleton-header" />
        <div className="skeleton-grid">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
        <div className="skeleton-panel" />
      </div>
    </div>
  );
}

