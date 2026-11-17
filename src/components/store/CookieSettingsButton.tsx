"use client";
/** Footer link that reopens the cookie choice. */
export default function CookieSettingsButton({ className = "" }: { className?: string }) {
  return <button type="button" className={className} onClick={() => window.dispatchEvent(new Event("gp:cookie-settings"))}>Cookie settings</button>;
}
