// Formats a past timestamp as a human-readable relative age.
// Examples: "just now", "12 min ago", "2 hr ago", "1 day ago", "3 days ago".
//
// Used by map tooltips and the Signal Summary to surface data freshness so
// users can judge whether crowd-sourced readings are still representative.

export function formatRelative(ts: string | Date | number | undefined | null): string {
  if (ts === undefined || ts === null) return '—';

  let then: number;
  if (typeof ts === 'number') {
    then = ts;
  } else if (ts instanceof Date) {
    then = ts.getTime();
  } else {
    then = new Date(ts).getTime();
  }

  if (isNaN(then)) return '—';

  const diffMs = Date.now() - then;

  // Future timestamps shouldn't happen but guard against clock skew
  if (diffMs < 0) return 'just now';

  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return 'just now';

  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;

  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;

  const years = Math.floor(days / 365);
  return `${years} yr${years > 1 ? 's' : ''} ago`;
}
