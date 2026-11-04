// Shared (client + server safe). Shipping carriers offered in the admin and the tracking link for each.
// Deep links are a convenience: a customer can always copy the tracking number. Only carriers whose public tracking
// URL takes the number as a parameter get a link; for others staff may paste an https tracking page.
export const CARRIERS = [
  { id: "delhivery", name: "Delhivery", url: (n: string) => `https://www.delhivery.com/track/package/${encodeURIComponent(n)}` },
  { id: "dhl", name: "DHL", url: (n: string) => `https://www.dhl.com/in-en/home/tracking/tracking-express.html?submit=1&tracking-id=${encodeURIComponent(n)}` },
  { id: "fedex", name: "FedEx", url: (n: string) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}` },
  { id: "ups", name: "UPS", url: (n: string) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}` },
  { id: "india-post", name: "India Post", url: null },
  { id: "bluedart", name: "Blue Dart", url: null },
  { id: "dtdc", name: "DTDC", url: null },
  { id: "other", name: "Other carrier", url: null },
] as const;
export type CarrierId = (typeof CARRIERS)[number]["id"];
export const CARRIER_IDS = CARRIERS.map((c) => c.id) as [CarrierId, ...CarrierId[]];
export const carrierName = (id: string) => CARRIERS.find((c) => c.id === id)?.name ?? id;

/** Tracking page for a shipment: staff-supplied https URL first, else the carrier's link, else null. */
export function trackingLink(carrier: string, trackingNumber: string, custom?: string | null): string | null {
  if (custom && /^https:\/\//i.test(custom)) return custom;
  return CARRIERS.find((c) => c.id === carrier)?.url?.(trackingNumber) ?? null;
}
