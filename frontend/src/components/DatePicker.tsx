import { addDays, formatDisplayDate, todayIso } from '../lib/date';

interface DatePickerProps {
  date: string;
  onChange: (date: string) => void;
}

export function DatePicker({ date, onChange }: DatePickerProps) {
  return (
    <div className="date-picker">
      <button type="button" onClick={() => onChange(addDays(date, -1))} aria-label="Previous day">
        ‹
      </button>
      <div className="date-picker-label">
        <span>{formatDisplayDate(date)}</span>
        {date !== todayIso() && (
          <button type="button" className="date-picker-today" onClick={() => onChange(todayIso())}>
            Today
          </button>
        )}
      </div>
      <button type="button" onClick={() => onChange(addDays(date, 1))} aria-label="Next day">
        ›
      </button>
    </div>
  );
}
