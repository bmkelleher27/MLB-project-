export type ScorecardView = 'compact' | 'grid';

const KEY = 'scorecardView';

/** Explicit user choice, or null to follow the device default. */
export function getScorecardView(): ScorecardView | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'compact' || v === 'grid' ? v : null;
  } catch {
    return null;
  }
}

export function setScorecardView(view: ScorecardView): void {
  try {
    localStorage.setItem(KEY, view);
  } catch {
    // private mode etc - preference just won't persist
  }
}
