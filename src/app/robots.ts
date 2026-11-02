import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""); // static file: no DB/secret env needed at build
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/cart", "/checkout", "/order/", "/preview/", "/search", "/login", "/page-not-found"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
