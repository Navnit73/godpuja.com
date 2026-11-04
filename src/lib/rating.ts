// Shared (client + server safe). Ratings are whole stars 1–5; averages are kept to two decimals.
export const STARS = [1, 2, 3, 4, 5] as const;

/** Average from the running totals kept on the product (0 when there are no ratings). */
export const averageOf = (sum: number, count: number) => (count > 0 ? Math.round((sum / count) * 100) / 100 : 0);

/** "4.5" for display; whole numbers stay whole ("4"). */
export const formatRating = (avg: number) => (Number.isInteger(avg) ? String(avg) : avg.toFixed(1));

/** Text for screen readers and tooltips: "Rated 4.5 out of 5 from 12 reviews". */
export const ratingText = (avg: number, count: number) => `Rated ${formatRating(avg)} out of 5 from ${count} ${count === 1 ? "review" : "reviews"}`;
