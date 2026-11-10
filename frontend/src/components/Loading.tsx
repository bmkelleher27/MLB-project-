/**
 * The one loading indicator for anything that isn't a layout skeleton: a
 * spinner beside a short label, announced politely to screen readers. Pages
 * used to show bare "Loading…" text in the same muted style as empty states,
 * so a slow request was indistinguishable from "nothing here".
 */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="status-message status-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </p>
  );
}
