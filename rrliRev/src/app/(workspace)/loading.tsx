export default function WorkspaceLoading() {
  return (
    <div
      className="content-wrap page-loading-container"
      role="status"
      aria-label="Loading workspace"
    >
      <div className="neumorph-loading">
        <div className="neumorph-glow-circle" aria-hidden="true" />
        <p className="neumorph-loading-text">Loading workspace…</p>
      </div>
    </div>
  );
}
