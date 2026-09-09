import { useState, useMemo } from 'react';

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
const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function MiniCalendar({
  markedDates,
  selectedDate,
  onSelectDate,
}: {
  markedDates: Set<string>;
  selectedDate?: string;
  onSelectDate?: (dateKey: string) => void;
}) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const today = useMemo(() => new Date(), []);
  const activeSelected = selectedDate ?? dateKey(today.getFullYear(), today.getMonth(), today.getDate());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const startOffset = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const weekStrip = useMemo(() => {
    const list = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const key = dateKey(d.getFullYear(), d.getMonth(), d.getDate());
      list.push({
        dateObj: d,
        dayNum: d.getDate(),
        dayName: DAY_NAMES[d.getDay()],
        monthName: d.toLocaleDateString([], { month: 'long' }).toUpperCase(),
        key,
        isToday: d.toDateString() === today.toDateString(),
      });
    }
    return list;
  }, [today]);

  function isToday(day: number) {
    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
  }

  function changeMonth(delta: number) {
    setViewDate(new Date(year, month + delta, 1));
  }

  return (
    <div className="mini-calendar">
      {}
      <div className="mini-calendar-desktop">
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
          {cells.map((day, i) => {
            if (day === null) return <span key={i} className="mini-calendar-cell empty" />;
            const key = dateKey(year, month, day);
            const hasMark = markedDates.has(key);
            const isSelected = activeSelected === key;
            return (
              <span
                key={i}
                className={`mini-calendar-cell${isToday(day) ? ' today' : ''}${hasMark ? ' marked' : ''}${isSelected ? ' is-selected' : ''}`}
                style={hasMark ? { cursor: 'pointer' } : { opacity: 0.6 }}
                onClick={() => {
                  if (hasMark && onSelectDate) onSelectDate(key);
                }}
              >
                {day}
              </span>
            );
          })}
        </div>
      </div>

      {}
      <div className="mini-calendar-mobile-strip">
        <div className="mobile-strip-header">
          <span className="mobile-strip-month-badge">
            {today.toLocaleDateString([], { month: 'long' }).toUpperCase()}
          </span>
        </div>
        <div className="mobile-strip-row">
          {weekStrip.map((item) => {
            const isSelected = activeSelected === item.key;
            const hasMark = markedDates.has(item.key);
            return (
              <button
                type="button"
                key={item.key}
                disabled={!hasMark}
                className={`mobile-strip-item${item.isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${!hasMark ? ' is-disabled' : ''}`}
                onClick={() => {
                  if (hasMark && onSelectDate) {
                    onSelectDate(item.key);
                  }
                }}
                title={hasMark ? `Click to view consultations for ${item.dayName} ${item.dayNum}` : 'No consultations on this date'}
              >
                <span className="mobile-strip-day-num">{item.dayNum}</span>
                <span className="mobile-strip-day-name">{item.dayName}</span>
                {hasMark && <span className="mobile-strip-dot" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
