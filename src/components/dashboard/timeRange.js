import { useMemo } from 'react';

const computeRange = (key) => {
  const indiaParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const today = `${indiaParts.year}-${indiaParts.month}-${indiaParts.day}`;
  const atNoonUtc = (iso) => new Date(`${iso}T12:00:00Z`);
  const toDateStr = (date) => date.toISOString().slice(0, 10);
  const shiftDays = (iso, days) => {
    const date = atNoonUtc(iso);
    date.setUTCDate(date.getUTCDate() + days);
    return toDateStr(date);
  };
  const [year, month] = today.split('-').map(Number);

  if (key === 'today') return { start: today, end: shiftDays(today, 1) };
  if (key === 'this_week') {
    const day = atNoonUtc(today).getUTCDay() || 7;
    return { start: shiftDays(today, 1 - day), end: shiftDays(today, 1) };
  }
  if (key === 'this_month') return { start: `${year}-${String(month).padStart(2, '0')}-01`, end: shiftDays(today, 1) };
  if (key === 'this_year') return { start: `${year}-01-01`, end: shiftDays(today, 1) };
  return { start: '1900-01-01', end: '2101-01-01' };
};

export const useTimeRange = (preset) => useMemo(() => computeRange(preset), [preset]);
