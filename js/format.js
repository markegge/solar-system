// Display formatting helpers
export function fmtNum(x, digits = 0) {
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Duration given in days -> human string
export function fmtDuration(days) {
  if (days == null) return '—';
  if (!isFinite(days)) return 'never (tidally locked to the Sun)';
  const d = Math.abs(days);
  if (d < 2) {
    let s = Math.round(d * 86400);
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    return `${h} h ${String(m).padStart(2, '0')} m${h < 10 ? ` ${String(s).padStart(2, '0')} s` : ''}`;
  }
  if (d < 1000) return `${fmtNum(d, d < 100 ? 2 : 1)} days`;
  return `${fmtNum(d / 365.25, 2)} years`;
}

export function fmtDurationSub(days) {
  if (days == null || !isFinite(days)) return '';
  const d = Math.abs(days);
  if (d < 2) return `${fmtNum(d, 4)} Earth days`;
  if (d < 1000) return `${fmtNum(d * 24, 0)} hours`;
  return `${fmtNum(d, 0)} days`;
}

export function fmtDistanceKm(km) {
  const AU = 149597870.7;
  if (km > 0.05 * AU) return `${fmtNum(km / AU, 3)} AU`;
  return `${fmtNum(km, 0)} km`;
}
