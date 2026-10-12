const DAY = 24 * 60 * 60 * 1000;
const exactDate = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true
});

export function formatAppliedDate(appliedAt: string | null, now: Date): { relative: string; exact: string } | null {
  if (!appliedAt) return null;
  const date = new Date(appliedAt);
  const elapsed = now.getTime() - date.getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return null;

  const days = Math.floor(elapsed / DAY);
  let relative = "Today";
  if (days > 0) {
    const amount = days >= 30 ? Math.floor(days / 30) : days >= 7 ? Math.floor(days / 7) : days;
    const unit = days >= 30 ? "month" : days >= 7 ? "week" : "day";
    relative = `${amount} ${unit}${amount === 1 ? "" : "s"} ago`;
  }
  return { relative, exact: exactDate.format(date) };
}
