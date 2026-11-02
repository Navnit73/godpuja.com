// Demo CMS pages. Policy pages are sensible starting points for an Indian e-commerce store — have them reviewed
// before going live (they are not legal advice).
import type { Motif, PALETTES } from "./art";

type Section =
  | { type: "richtext"; markdown: string }
  | { type: "imageText"; heading: string; markdown: string; motif: Motif; palette: keyof typeof PALETTES; imageAlt: string; imagePosition: "left" | "right"; ctaLabel?: string; ctaUrl?: string };
export type DemoPage = { slug: string; title: string; description: string; sections: Section[] };

export const PAGES: DemoPage[] = [
  {
    slug: "about-us", title: "About GodPuja",
    description: "GodPuja brings authentic puja samagri, handcrafted idols and festival kits to homes across India.",
    sections: [
      { type: "richtext", markdown: "## Our story\n\nGodPuja began with a simple problem: finding pure, complete puja samagri before a festival meant visiting five shops and still forgetting something. We now put together everything a family needs — measured, packed and checked against the puja vidhi by practising pandits." },
      { type: "imageText", heading: "Handcrafted by artisans", markdown: "Our brass idols and lamps are cast and finished in **Moradabad**, our diyas are shaped and kiln-fired by potter families in **Rajasthan**, and our malas are knotted in **Vrindavan**. We buy directly and pay fairly.", motif: "samai", palette: "gold", imageAlt: "Brass samai lamp", imagePosition: "right" },
      { type: "imageText", heading: "Pure ingredients, nothing artificial", markdown: "Our kumkum is made from turmeric and lime, our camphor is natural Bhimseni, and our agarbatti is charcoal-free. If we would not use it in our own mandir, we do not sell it.", motif: "kumkum", palette: "kumkum", imageAlt: "Bowls of kumkum and haldi", imagePosition: "left", ctaLabel: "Shop puja essentials", ctaUrl: "/category/puja-essentials" },
    ],
  },
  {
    slug: "contact-us", title: "Contact us",
    description: "Questions about an order, a product or a puja? Here is how to reach the GodPuja team.",
    sections: [
      { type: "richtext", markdown: "## We are here to help\n\n**Email:** support@godpuja.com — we reply within one working day.\n\n**Hours:** Monday to Saturday, 10 am – 7 pm IST.\n\n**Address:** Varanasi, Uttar Pradesh, India.\n\nFor an existing order, please include your **order number** (it starts with GP-) so we can help faster.\n\n### Bulk and temple orders\n\nOrdering for a temple, a community puja or a wedding? Write to us with the list and dates and we will send a quote." },
    ],
  },
  {
    slug: "faq", title: "Frequently asked questions",
    description: "Answers about orders, delivery, payment, returns and our products.",
    sections: [
      { type: "richtext", markdown: "## Orders & payment\n\n**Which payment methods do you accept?**\nCash on delivery is available across India. Online payments will be added soon.\n\n**Do I need an account to order?**\nNo. You can check out as a guest; we email your order confirmation.\n\n## Delivery\n\n**How long does delivery take?**\nMost orders are dispatched within 1–2 working days and arrive in 3–7 working days depending on your pin code.\n\n**Is shipping free?**\nShipping is free on orders of ₹999 and above; a flat fee applies below that.\n\n## Products\n\n**Are your idols solid brass?**\nYes — every item listed as brass is solid cast brass, not brass-plated.\n\n**Why do product photos look like illustrations?**\nEach piece is handmade, so finish and colour vary slightly; we show illustrations and describe exact sizes and materials.\n\n## Returns\n\n**What if something arrives broken?**\nWrite to us within 48 hours with a photo and we will replace it or refund you. See our [returns policy](/returns-refunds)." },
    ],
  },
  {
    slug: "shipping-policy", title: "Shipping & delivery",
    description: "Delivery times, charges and coverage for GodPuja orders.",
    sections: [
      { type: "richtext", markdown: "## Where we deliver\n\nWe deliver to most serviceable pin codes in India through trusted courier partners.\n\n## Dispatch and delivery time\n\n- Orders are dispatched within **1–2 working days**.\n- Delivery usually takes **3–7 working days** after dispatch.\n- Festival weeks (Diwali, Navratri) can add 1–2 days — order festival kits early.\n\n## Charges\n\n- **Free shipping** on orders of ₹999 or more.\n- A flat shipping fee applies to smaller orders and is shown at checkout before you place the order.\n\n## Fragile items\n\nBrass, glass and clay items are packed with extra cushioning. If anything arrives damaged, see our [returns & refunds policy](/returns-refunds)." },
    ],
  },
  {
    slug: "returns-refunds", title: "Returns & refunds",
    description: "How returns, replacements and refunds work at GodPuja.",
    sections: [
      { type: "richtext", markdown: "## Damaged or wrong items\n\nIf an item arrives damaged, defective or different from what you ordered, email **support@godpuja.com** within **48 hours of delivery** with your order number and a photo. We will send a replacement or issue a full refund.\n\n## Change of mind\n\nUnused idols, lamps, thalis and malas can be returned within **7 days** of delivery in their original packing. Return shipping is paid by the customer.\n\n## Non-returnable items\n\nFor hygiene and religious reasons, opened samagri, kumkum, haldi, camphor, incense, havan samagri and used puja kits cannot be returned.\n\n## Refunds\n\nApproved refunds for cash-on-delivery orders are paid by bank transfer (UPI or NEFT) within **5–7 working days** of approval." },
    ],
  },
  {
    slug: "privacy-policy", title: "Privacy policy",
    description: "What personal data GodPuja collects, why, and how we protect it.",
    sections: [
      { type: "richtext", markdown: "## What we collect\n\nWhen you place an order we collect your name, email, phone number and delivery address. If you subscribe to our newsletter we store your email address.\n\n## Why we use it\n\n- To deliver your order and contact you about it.\n- To send festival reminders and offers, only if you subscribed.\n- To prevent fraud and keep the store secure.\n\n## Sharing\n\nWe share your delivery details only with the courier delivering your order. We never sell your data.\n\n## Your choices\n\nYou can unsubscribe from emails at any time, and you can ask us to access, correct or delete your data by writing to support@godpuja.com.\n\n## Cookies\n\nWe use only the cookies needed to run the store (for example, to remember your cart and keep staff signed in). We do not use advertising trackers." },
    ],
  },
  {
    slug: "terms-and-conditions", title: "Terms & conditions",
    description: "The terms that apply when you use the GodPuja website and place an order.",
    sections: [
      { type: "richtext", markdown: "## Using this website\n\nBy using godpuja.com you agree to these terms. Please read them together with our [privacy policy](/privacy-policy).\n\n## Products and prices\n\nPrices are in Indian Rupees and include applicable taxes. Handmade items may vary slightly from their description in size, colour and finish. We may correct pricing errors before dispatch; if we do, we will contact you first.\n\n## Orders\n\nAn order is confirmed when you receive our confirmation email. We may cancel an order if an item is out of stock or an address cannot be served, and we will refund any amount paid.\n\n## Returns\n\nReturns are covered by our [returns & refunds policy](/returns-refunds).\n\n## Contact\n\nQuestions about these terms: support@godpuja.com." },
    ],
  },
];
