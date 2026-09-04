import { useState } from 'react';

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MiniCalendar({ markedDates }: { markedDates: Set<string> }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const today = new Date();

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isToday(day: number) {
    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
  }

  function changeMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  return (
    <div className="mini-calendar">
      <div className="mini-calendar-header">
        <button type="button" className="mini-calendar-nav" onClick={() => changeMonth(-1)} aria-label="Previous month">
          <ChevronLeftIcon />
        </button>
        <span className="mini-calendar-title">{viewDate.toLocaleDateString([], { month: 'long', year: 'numeric' })}</span>
        <button type="button" className="mini-calendar-nav" onClick={() => changeMonth(1)} aria-label="Next month">
          <ChevronRightIcon />
        </button>
      </div>

      <div className="mini-calendar-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>

      <div className="mini-calendar-grid">
        {cells.map((day, i) =>
          day === null ? (
            <span key={i} className="mini-calendar-cell empty" />
          ) : (
            <span
              key={i}
              className={`mini-calendar-cell${isToday(day) ? ' today' : ''}${
                markedDates.has(dateKey(year, month, day)) ? ' marked' : ''
              }`}
            >
              {day}
            </span>
          ),
        )}
      </div>
    </div>
  );
}
