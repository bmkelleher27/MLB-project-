import { addDays, formatDisplayDate, todayIso } from '../lib/date';

interface DatePickerProps {
  date: string;
  onChange: (date: string) => void;
}

export function DatePicker({ date, onChange }: DatePickerProps) {
  const today = todayIso();
  const yesterday = addDays(today, -1);
  return (
    <div className="date-picker">
      <button type="button" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">
        ‹
      </button>
      <div className="date-picker-label">
        <span>{formatDisplayDate(date)}</span>
        <span className="date-picker-quick">
          {date !== yesterday && (
            <button type="button" className="date-picker-today" onClick={() => onChange(yesterday)}>
              Yesterday
            </button>
          )}
          {date !== today && (
            <button type="button" className="date-picker-today" onClick={() => onChange(today)}>
              Today
            </button>
          )}
        </span>
      </div>
      <button type="button" onClick={() => onChange(addDays(date, 1))} aria-label="Next day">
        ›
      </button>
    </div>
  );
}
