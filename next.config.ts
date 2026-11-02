import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Content Security Policy. Static (set here, not per request) because `cacheComponents` prerenders page shells,
 * and a per-request nonce cannot be embedded in a prerendered shell. Consequences, accepted deliberately:
 *  - script-src needs 'unsafe-inline' for Next's inline RSC/bootstrap scripts. XSS defence for CMS content is the
 *    sanitiser (server/markdown.ts); CSP still blocks scripts from any other origin, plugins, <base> hijacking,
 *    cross-site form posts, framing and fetch/XHR to other origins.
 *  - img-src allows any https origin because admins may paste image URLs from any host.
 * Dev additionally needs 'unsafe-eval' (React debugging) and websockets (HMR).
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "media-src 'self'",
  "frame-src 'none'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  async redirects() {
    // The CMS page "home" is the homepage; keep a single canonical URL.
    return [{ source: "/home", destination: "/", permanent: true }];
  },
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Hardening for every response.
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          ...(!isDev ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
      {
        // Order confirmation URLs carry a secret access token: same protections as preview links.
        source: "/order/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        // Secret-token preview: never leak the URL via Referer, never index, never cache.
        source: "/preview/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
