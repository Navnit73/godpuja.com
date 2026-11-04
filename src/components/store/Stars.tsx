import { ratingText } from "@/lib/rating";

const STAR = "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.4 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9L12 2.5z";
const Row = ({ className }: { className: string }) => (
  <span className="flex shrink-0">{[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" className={`h-4 w-4 shrink-0 ${className}`} fill="currentColor" aria-hidden="true"><path d={STAR} /></svg>)}</span>
);

/** Read-only stars, filled in proportion to the average. The meaning is in the text for screen readers. */
export default function Stars({ avg, count, showCount = true, className = "" }: { avg: number; count: number; showCount?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span className="relative inline-flex" aria-hidden="true">
        <Row className="text-sandal-300" />
        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${Math.min(100, (avg / 5) * 100)}%` }}><Row className="text-gold-500" /></span>
      </span>
      <span className="sr-only">{ratingText(avg, count)}</span>
      {showCount && <span className="text-xs text-muted" aria-hidden="true">{Number.isInteger(avg) ? avg : avg.toFixed(1)} ({count})</span>}
    </span>
  );
}
