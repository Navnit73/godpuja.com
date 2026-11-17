/**
 * Starting text for the Phase 1 legal pages (PRD v1.1 §19.2). They describe what this app actually does today; the owner
 * (and legal advisers) MUST review and adjust them before they are published, especially retention periods and the
 * controller's contact details. Created as DRAFTS only.
 */
export const LEGAL_PAGES = [
  {
    slug: "cookies", title: "Cookie policy",
    description: "Which cookies and similar storage GodPuja uses, and how to change your choice.",
    markdown: `## What we use

**Essential (always on).** A sign-in cookie (\`gp_session\`) keeps you signed in. Your cart, saved coupon code, wishlist and recently viewed items are kept in your browser's local storage on your own device. Without these the shop cannot work, so they do not need consent.

**Analytics (only if you accept).** If you click **Accept analytics**, we load Google Analytics 4, which sets cookies (\`_ga\`, \`_ga_*\`) to count visits and see which pages are useful. We ask Google to anonymise IP addresses. We do not use advertising or retargeting cookies.

## Your choice

When you first visit we ask whether to allow analytics. Nothing for analytics is loaded until you accept. Choosing **Reject analytics** is as easy as accepting. You can change your mind at any time with **Cookie settings** in the footer; rejecting removes the analytics cookies we set.

## More

See our [privacy policy](/privacy-policy) for how we handle personal data, and [how long we keep it](/data-retention).`,
  },
  {
    slug: "data-retention", title: "Data retention and deletion",
    description: "How long GodPuja keeps your data and how to ask for it to be deleted.",
    markdown: `## How long we keep data

| Data | Kept for | Why |
|---|---|---|
| Account details (name, email, saved addresses) | While your account is open | To run your account |
| Orders, invoices and payment records | 8 years after the order | Tax and accounting law |
| Reviews you write | Until you ask us to remove them | Shown to other shoppers |
| Newsletter email address | Until you unsubscribe | To send what you asked for |
| Support emails | 2 years | To resolve issues and improve service |
| Analytics (if you accepted) | 14 months | Understanding which pages help |

## Deleting your data

Write to **support@godpuja.com** from the email on your account and ask us to delete it. We will confirm within 30 days. We may need to keep order and payment records for the period above; if so we remove everything else and tell you what remains and why.

## Access and correction

You can ask for a copy of your data, or for corrections, at the same address. Your saved addresses can also be edited from your account.

See also the [privacy policy](/privacy-policy) and [cookie policy](/cookies).`,
  },
] as const;

/** The existing privacy policy must mention analytics once GA4 is switched on. */
export const PRIVACY_ANALYTICS_NOTE = `## Analytics

If you accept analytics cookies, we use Google Analytics 4 to understand how the site is used. See the [cookie policy](/cookies) for what is stored and how to change your choice, and [data retention](/data-retention) for how long we keep data and how to ask for deletion.`;
