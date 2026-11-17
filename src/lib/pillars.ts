/**
 * The five pillars plus Donate (PRD v1.1 §3, §4). A pillar is "soon" until its stage ships: flip `live` then.
 * Soon pillars link to a "coming soon" page instead of a dead end.
 */
export const PILLARS = [
  { key: "shop", label: "Shop Products", text: "Puja samagri, idols and more", href: "/shop", live: true },
  { key: "temples", label: "Find Temples", text: "Temples and their services", href: "/temples", live: false },
  { key: "book", label: "Book a Pooja", text: "At a temple, at home or online", href: "/book-a-pooja", live: false },
  { key: "vidhi", label: "Pooja Vidhi", text: "Step-by-step ritual guides", href: "/pooja-vidhi", live: true },
  { key: "aarti", label: "Aarti & Mantras", text: "Lyrics, meaning and audio", href: "/aarti", live: true },
  { key: "donate", label: "Donate", text: "Support temples and seva", href: "/donate", live: false },
] as const;

/** Pages for pillars that are not live yet. */
export const COMING_SOON = {
  temples: { path: "temples", title: "Find Temples", text: "A directory of temples with their timings, services and verified details is on its way." },
  "book-a-pooja": { path: "book-a-pooja", title: "Book a Pooja", text: "Soon you will be able to book a pooja at a temple, or ask for a Pandit at home, at another venue or online." },
  donate: { path: "donate", title: "Donate", text: "Donations to temples and seva programmes will open once our payment and verification steps are ready." },
} as const;
export type ComingSoonKey = keyof typeof COMING_SOON;
