import { notFound } from "next/navigation";

// The proxy rewrites unknown storefront URLs here. notFound() runs before anything streams, so the response is a
// real HTTP 404 (with the normal not-found UI and noindex), not a "soft 404".
export default function PageNotFound() {
  notFound();
}
