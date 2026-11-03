import { SearchIcon } from "./Icons";

/** Plain GET search form: works without JavaScript. */
export default function HeaderSearch({ className = "", id = "header-q" }: { className?: string; id?: string }) {
  return (
    <form method="get" action="/search" role="search" aria-label="Site search" className={`relative ${className}`}>
      <label htmlFor={id} className="sr-only">Search products</label>
      <input id={id} name="q" type="search" maxLength={100} placeholder="Search diyas, idols, puja kits…"
        className="input h-11 rounded-full border-sandal-300 bg-sandal-50 pl-5 pr-14 focus:bg-surface" />
      <button type="submit" className="absolute right-1 top-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-saffron-800">
        <SearchIcon className="h-4 w-4" /><span className="sr-only">Search</span>
      </button>
    </form>
  );
}
