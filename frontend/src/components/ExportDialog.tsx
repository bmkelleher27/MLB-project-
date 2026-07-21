import { useEffect, useState } from 'react';
import type { ExportOptions } from '../lib/exportOptions';

export function ExportDialog({
  initial,
  onCancel,
  onExport,
}: {
  initial: ExportOptions;
  onCancel: () => void;
  onExport: (options: ExportOptions) => void;
}) {
  const [opts, setOpts] = useState<ExportOptions>(initial);
  const set = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) =>
    setOpts((o) => ({ ...o, [key]: value }));

  // Escape closes the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="export-backdrop" onClick={onCancel}>
      <div
        className="export-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Export scorecard as PDF"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="export-dialog-title">Export scorecard</h2>
        <p className="export-dialog-sub">Choose how the PDF should look and what to include.</p>

        <fieldset className="export-group">
          <legend>Style</legend>
          <label className="export-radio">
            <input
              type="radio"
              name="style"
              checked={opts.style === 'broadcast'}
              onChange={() => set('style', 'broadcast')}
            />
            <span>
              <strong>Broadcast</strong>
              <small>Dark score-bug header, team colors, logos.</small>
            </span>
          </label>
          <label className="export-radio">
            <input
              type="radio"
              name="style"
              checked={opts.style === 'minimal'}
              onChange={() => set('style', 'minimal')}
            />
            <span>
              <strong>Minimal</strong>
              <small>Clean light header, no color fills.</small>
            </span>
          </label>
        </fieldset>

        <fieldset className="export-group">
          <legend>Include</legend>
          <label className="export-check">
            <input type="checkbox" checked={opts.pitching} onChange={(e) => set('pitching', e.target.checked)} />
            Pitching lines
          </label>
          <label className="export-check">
            <input type="checkbox" checked={opts.legend} onChange={(e) => set('legend', e.target.checked)} />
            Scoring key
          </label>
          <label className="export-check">
            <input type="checkbox" checked={opts.logos} onChange={(e) => set('logos', e.target.checked)} />
            Team logos
          </label>
        </fieldset>

        <fieldset className="export-group">
          <legend>Printing</legend>
          <label className="export-check">
            <input type="checkbox" checked={opts.inkSaver} onChange={(e) => set('inkSaver', e.target.checked)} />
            Ink saver <small>— black &amp; white, no background fills</small>
          </label>
        </fieldset>

        <div className="export-actions">
          <button className="export-btn export-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button className="export-btn export-btn-primary" onClick={() => onExport(opts)}>
            ⤓ Export PDF
          </button>
        </div>
      </div>
    </div>
  );
}
