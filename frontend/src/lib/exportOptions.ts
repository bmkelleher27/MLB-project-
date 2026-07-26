export interface ExportOptions {
  /** Visual treatment: broadcast score-bug vs. a clean minimal header. */
  style: 'broadcast' | 'minimal';
  /** Strip background fills for black-on-white printing. */
  inkSaver: boolean;
  /** Draw only the path the batter reached, no full-diamond outline, in every style. */
  simpleDiamonds: boolean;
  /** Sections to include. */
  pitching: boolean;
  legend: boolean;
  logos: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  style: 'broadcast',
  inkSaver: false,
  simpleDiamonds: false,
  pitching: true,
  legend: true,
  logos: true,
};

const KEY = 'exportOptions';

export function loadExportOptions(): ExportOptions {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_EXPORT_OPTIONS, ...(JSON.parse(raw) as Partial<ExportOptions>) } : DEFAULT_EXPORT_OPTIONS;
  } catch {
    return DEFAULT_EXPORT_OPTIONS;
  }
}

export function saveExportOptions(options: ExportOptions): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    // private mode etc - choices just won't persist
  }
}
