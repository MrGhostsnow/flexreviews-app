export function formatRelativeTime(input: string | null | undefined) {
  if (!input) return "never";

  const then = new Date(input);
  if (Number.isNaN(then.getTime())) return "never";

  const diffMin = Math.round((Date.now() - then.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;

  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;

  const diffDay = Math.round(diffHr / 24);
  return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
}

export function formatStars(rating: number) {
  const n = Math.max(0, Math.min(5, Math.round(rating) || 0));
  return "★".repeat(n) + "☆".repeat(5 - n);
}
