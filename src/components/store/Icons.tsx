// Decorative inline icons (24px grid, stroke = currentColor). Always aria-hidden: pair with visible or sr-only text.
type P = { className?: string };
const base = (className = "h-5 w-5") => ({
  className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true,
});

export const SearchIcon = ({ className }: P) => <svg {...base(className)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const CartIcon = ({ className }: P) => <svg {...base(className)}><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6" /><circle cx="10" cy="20.5" r="1" /><circle cx="17" cy="20.5" r="1" /></svg>;
export const UserIcon = ({ className }: P) => <svg {...base(className)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
export const MenuIcon = ({ className }: P) => <svg {...base(className)}><path d="M4 7h16M4 12h16M4 17h16" /></svg>;
export const CloseIcon = ({ className }: P) => <svg {...base(className)}><path d="M6 6l12 12M18 6 6 18" /></svg>;
export const ArrowRight = ({ className = "h-4 w-4" }: P) => <svg {...base(className)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const ChevronDown = ({ className = "h-4 w-4" }: P) => <svg {...base(className)}><path d="m6 9 6 6 6-6" /></svg>;
export const ChevronRight = ({ className = "h-3.5 w-3.5" }: P) => <svg {...base(className)}><path d="m9 6 6 6-6 6" /></svg>;
export const PhoneIcon = ({ className = "h-4 w-4" }: P) => <svg {...base(className)}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;
export const MailIcon = ({ className = "h-4 w-4" }: P) => <svg {...base(className)}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>;
export const PinIcon = ({ className = "h-4 w-4" }: P) => <svg {...base(className)}><path d="M12 21s-7-6.2-7-12a7 7 0 0 1 14 0c0 5.8-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></svg>;
export const TruckIcon = ({ className }: P) => <svg {...base(className)}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>;
export const ShieldIcon = ({ className }: P) => <svg {...base(className)}><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>;
export const GiftIcon = ({ className }: P) => <svg {...base(className)}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-2-4-6-4-6-1.5S10 8 12 8zm0 0c2-4 6-4 6-1.5S14 8 12 8z" /></svg>;
export const HeadsetIcon = ({ className }: P) => <svg {...base(className)}><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>;
export const QuoteIcon = ({ className = "h-8 w-8" }: P) => (
  <svg className={className} viewBox="0 0 32 32" fill="currentColor" aria-hidden="true"><path d="M13 8C7.5 9.5 4 13.6 4 19.5 4 23 6 25 8.8 25c2.5 0 4.2-1.8 4.2-4.2 0-2.3-1.6-4-3.8-4-.5 0-1 .1-1.3.2.6-3 2.8-5.4 5.8-6.4zm15 0c-5.5 1.5-9 5.6-9 11.5 0 3.5 2 5.5 4.8 5.5 2.5 0 4.2-1.8 4.2-4.2 0-2.3-1.6-4-3.8-4-.5 0-1 .1-1.3.2.6-3 2.8-5.4 5.8-6.4z" /></svg>
);

/** Small lotus ornament used under section titles and as a divider. */
export function LotusOrnament({ className = "h-4 w-16 text-accent" }: P) {
  return (
    <svg className={className} viewBox="0 0 64 16" fill="none" aria-hidden="true">
      <path d="M0 8h22M42 8h22" stroke="currentColor" strokeWidth="1.2" />
      <path d="M32 2c2.4 2.6 2.4 7.4 0 11-2.4-3.6-2.4-8.4 0-11z" fill="currentColor" />
      <path d="M32 13c-2-3-5.5-4.5-8-4 1.2 2.8 4.2 4.4 8 4zm0 0c2-3 5.5-4.5 8-4-1.2 2.8-4.2 4.4-8 4z" fill="currentColor" opacity=".7" />
    </svg>
  );
}

/** Large faint mandala, decorative only (hero and promo panels). */
export function Mandala({ className = "" }: P) {
  const petals = Array.from({ length: 16 }, (_, i) => i * 22.5);
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none" stroke="currentColor" strokeWidth="0.8" aria-hidden="true">
      <circle cx="100" cy="100" r="96" /><circle cx="100" cy="100" r="78" strokeDasharray="2 4" /><circle cx="100" cy="100" r="24" /><circle cx="100" cy="100" r="10" />
      {petals.map((a) => <path key={a} d="M100 28c10 14 10 32 0 46-10-14-10-32 0-46z" transform={`rotate(${a} 100 100)`} />)}
      {petals.map((a) => <circle key={`d${a}`} cx="100" cy="12" r="2.4" transform={`rotate(${a + 11.25} 100 100)`} />)}
    </svg>
  );
}
