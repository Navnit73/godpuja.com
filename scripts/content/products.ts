// Extra catalogue for the content seed: categories from PRD v1.1 §5.1 that the demo catalogue lacks (books, accessories,
// gifts, festival collections) and ~45 products. Prices in rupees. Descriptions are generic and original.
import type { DemoCategory, DemoProduct } from "../demo/catalog";

export const EXTRA_CATEGORIES: DemoCategory[] = [
  { slug: "religious-books", name: "Religious Books", motif: "chowki", palette: "sandal", description: "Scriptures, chalisas, aarti collections and vrat katha books in Hindi and Sanskrit with meaning.",
    children: [
      { slug: "scriptures", name: "Scriptures", motif: "chowki", palette: "gold", description: "Bhagavad Gita, Ramayana, Puranas and Upanishads with commentary." },
      { slug: "chalisa-aarti-books", name: "Chalisa & Aarti Books", motif: "chowki", palette: "saffron", description: "Pocket chalisa, aarti sangrah and stotra collections." },
      { slug: "vrat-katha-books", name: "Vrat Katha Books", motif: "chowki", palette: "tulsi", description: "Katha and vidhi books for every vrat and festival." },
    ] },
  { slug: "spiritual-accessories", name: "Spiritual Accessories", motif: "conch", palette: "gold", description: "Yantras, conch shells, bells and mandir accessories.",
    children: [
      { slug: "yantras", name: "Yantras", motif: "kumkum", palette: "gold", description: "Copper and brass yantras for puja and vastu." },
      { slug: "pooja-accessories", name: "Pooja Accessories", motif: "thali", palette: "sandal", description: "Aasan, chowki, mandir stands and storage." },
    ] },
  { slug: "festival-collections", name: "Festival Collections", motif: "garland", palette: "kumkum", description: "Everything for the festival in front of you: Diwali, Navratri, Janmashtami, Holi and more.", children: [] },
  { slug: "spiritual-gifts", name: "Spiritual Gifts", motif: "kit", palette: "saffron", description: "Gift sets and hampers for housewarmings, weddings and festivals.", children: [] },
];

type X = { deity?: string; material?: string; occasion?: string; size?: string };
const P = (slug: string, name: string, category: string, motif: DemoProduct["motif"], palette: DemoProduct["palette"], price: number, short: string, o: Partial<DemoProduct> & X = {}): DemoProduct => {
  const { deity, material, occasion, size, ...rest } = o;
  const attributes: [string, string][] = [];
  if (deity) attributes.push(["Deity", deity]);
  if (material) attributes.push(["Material", material]);
  if (occasion) attributes.push(["Occasion", occasion]);
  if (size) attributes.push(["Size", size]);
  return { slug, name, category, brand: "GodPuja", motif, palette, price, stock: 40 + (price % 90), sold: 20 + (price % 400), short, highlights: [short.split(/[.—]/)[0].trim(), "Quality-checked before dispatch", "Packed to travel safely"], attributes, weight: 300, ...rest };
};
const book = (slug: string, name: string, cat: string, price: number, short: string, pages: number, lang: string, deity?: string) =>
  P(slug, name, `religious-books/${cat}`, "chowki", "sandal", price, short, { brand: "GodPuja Editorial", deity, attributes: [["Pages", String(pages)], ["Language", lang], ...(deity ? [["Deity", deity] as [string, string]] : []), ["Binding", pages > 300 ? "Hardcover" : "Paperback"]], weight: 150 + pages, highlights: ["Clear, large print", `${lang} text with simple meaning`, "Sturdy binding that lasts through daily use"] });

export const EXTRA_PRODUCTS: DemoProduct[] = [
  // ---- Religious books (12)
  book("bhagavad-gita-hindi", "Bhagavad Gita — Hindi with Meaning", "scriptures", 349, "All 18 chapters in Sanskrit with a word-by-word Hindi meaning.", 420, "Hindi, Sanskrit", "Krishna"),
  book("bhagavad-gita-english", "Bhagavad Gita — English Translation", "scriptures", 399, "Sanskrit verses with a plain English translation and short notes.", 380, "English, Sanskrit", "Krishna"),
  book("sundarkand-hindi", "Sundarkand — Hindi", "scriptures", 129, "The Sundarkand of the Ramcharitmanas in large print with meaning.", 160, "Hindi", "Hanuman"),
  book("ramcharitmanas-hindi", "Ramcharitmanas — Complete, Hindi", "scriptures", 899, "The complete Ramcharitmanas with Hindi meaning in a single hardcover volume.", 1100, "Hindi", "Rama"),
  book("durga-saptashati", "Durga Saptashati — Sanskrit & Hindi", "scriptures", 199, "Devi Mahatmya with Hindi meaning, for Navratri path.", 240, "Hindi, Sanskrit", "Durga"),
  book("vishnu-sahasranama", "Vishnu Sahasranama — with Meaning", "scriptures", 149, "The thousand names of Vishnu with meaning of each name.", 180, "Sanskrit, Hindi", "Vishnu"),
  book("hanuman-chalisa-pocket", "Hanuman Chalisa — Pocket Edition", "chalisa-aarti-books", 49, "Pocket-size Hanuman Chalisa with Hindi meaning and aarti.", 48, "Hindi", "Hanuman"),
  book("aarti-sangrah", "Aarti Sangrah — 51 Aartis", "chalisa-aarti-books", 99, "A collection of 51 popular aartis in Hindi.", 120, "Hindi"),
  book("shiv-chalisa-stotra", "Shiv Chalisa & Stotra Sangrah", "chalisa-aarti-books", 79, "Shiv Chalisa, Rudrashtakam, Panchakshara Stotra and aarti.", 96, "Hindi, Sanskrit", "Shiva"),
  book("satyanarayan-katha-book", "Satyanarayan Vrat Katha", "vrat-katha-books", 59, "All five adhyayas with puja vidhi and aarti.", 64, "Hindi", "Vishnu"),
  book("vrat-katha-sangrah", "Vrat Katha Sangrah", "vrat-katha-books", 179, "Katha for Ekadashi, Karwa Chauth, Santoshi Mata, Somvar and more.", 220, "Hindi"),
  book("garuda-purana-hindi", "Garuda Purana — Hindi", "scriptures", 249, "Garuda Purana in simple Hindi with explanation of key chapters.", 260, "Hindi", "Vishnu"),
  // ---- Spiritual accessories (8)
  P("shree-yantra-copper", "Shree Yantra — Copper", "spiritual-accessories/yantras", "kumkum", "gold", 899, "Engraved copper Shree Yantra for puja and desk.", { deity: "Lakshmi", material: "Copper", size: "3 inch", weight: 200 }),
  P("kuber-yantra-brass", "Kuber Yantra — Brass", "spiritual-accessories/yantras", "kumkum", "saffron", 549, "Brass Kuber Yantra on a stand, for the puja room or cash counter.", { deity: "Kuber", material: "Brass", size: "3 inch" }),
  P("vastu-pyramid-set", "Vastu Pyramid Set of 9", "spiritual-accessories/yantras", "kumkum", "tulsi", 449, "Nine copper-finish pyramids with a placement guide.", { material: "Copper finish" }),
  P("natural-conch-shankh", "Natural Conch (Shankh) — Medium", "spiritual-accessories", "conch", "sandal", 699, "A natural shankh that gives a clear, long note.", { material: "Conch shell", size: "Medium" }),
  P("cotton-pooja-aasan", "Cotton Pooja Aasan — Red", "spiritual-accessories/pooja-accessories", "chowki", "kumkum", 199, "Soft quilted cotton aasan, hand-embroidered border.", { material: "Cotton", size: "16 inch", occasion: "Daily puja" }),
  P("wooden-mandir-stand", "Wooden Mandir Stand — Compact", "spiritual-accessories/pooja-accessories", "chowki", "sandal", 1799, "Sheesham wood wall-mount mandir with a drawer.", { material: "Sheesham wood", size: "18 inch", weight: 4500 }),
  P("brass-hanging-bell", "Brass Hanging Bell with Chain", "spiritual-accessories/pooja-accessories", "bell", "gold", 599, "Door or mandir hanging bell with a deep, steady chime.", { material: "Brass", size: "4 inch" }),
  P("ghee-lamp-stand-brass", "Brass Lamp Stand (Deep Stambh)", "spiritual-accessories/pooja-accessories", "samai", "gold", 1299, "Tall five-wick brass lamp stand for aarti.", { material: "Brass", size: "12 inch", occasion: "Diwali" }),
  // ---- Festival collections (10)
  P("holi-puja-kit", "Holi Puja Kit", "festival-collections", "kit", "saffron", 599, "Holika Dahan samagri with gulal, coconut, cow dung cakes and puja items.", { occasion: "Holi" }),
  P("dhanteras-puja-kit", "Dhanteras Puja Kit", "festival-collections", "kit", "gold", 799, "Dhanteras samagri with a silver-finish coin, Kuber yantra card and diyas.", { occasion: "Dhanteras", deity: "Lakshmi" }),
  P("janmashtami-shringar-kit", "Janmashtami Laddu Gopal Shringar Kit", "festival-collections", "kit", "tulsi", 699, "Poshak, mukut, flute, jewellery and a small jhula set for Laddu Gopal.", { occasion: "Janmashtami", deity: "Krishna" }),
  P("raksha-bandhan-thali", "Raksha Bandhan Rakhi Thali", "festival-collections", "thali", "kumkum", 499, "Decorated thali with rakhi, roli, chawal and diya.", { occasion: "Raksha Bandhan" }),
  P("karwa-chauth-thali", "Karwa Chauth Pooja Thali Set", "festival-collections", "thali", "kumkum", 899, "Embroidered thali with karwa, sieve, diya and solah shringar items.", { occasion: "Karwa Chauth" }),
  P("maha-shivratri-kit", "Maha Shivratri Puja Kit", "festival-collections", "kit", "tulsi", 649, "Belpatra, bhasma, rudraksha, dhatura and abhishek samagri.", { occasion: "Maha Shivratri", deity: "Shiva" }),
  P("ram-navami-puja-kit", "Ram Navami Puja Kit", "festival-collections", "kit", "saffron", 749, "Ram darbar photo, tulsi mala and puja items for Ram Navami.", { occasion: "Ram Navami", deity: "Rama" }),
  P("chhath-puja-kit", "Chhath Puja Kit", "festival-collections", "kit", "gold", 1099, "Soop, daura, sindoor and offering items for Chhath.", { occasion: "Chhath" }),
  P("makar-sankranti-kit", "Makar Sankranti Til-Gud Kit", "festival-collections", "kit", "saffron", 399, "Til, jaggery and puja items for Sankranti.", { occasion: "Makar Sankranti" }),
  P("hanuman-jayanti-kit", "Hanuman Jayanti Puja Kit", "festival-collections", "kit", "kumkum", 549, "Sindoor, chola, flowers and a Chalisa booklet.", { occasion: "Hanuman Jayanti", deity: "Hanuman" }),
  // ---- Spiritual gifts (8)
  P("diwali-gift-hamper", "Diwali Gift Hamper", "spiritual-gifts", "kit", "kumkum", 1999, "Diya set, incense, kumkum box and a small brass Lakshmi-Ganesh in a gift box.", { occasion: "Diwali", salePrice: 1799 }),
  P("brass-diya-gift-set", "Brass Diya Gift Set of 4", "spiritual-gifts", "diya", "gold", 1099, "Four hand-polished brass diyas in a velvet-lined box.", { material: "Brass", occasion: "Diwali" }),
  P("lakshmi-ganesh-coin-set", "Lakshmi-Ganesh Coin Set", "spiritual-gifts", "idol", "gold", 1499, "Pair of silver-finish coins with a presentation box.", { deity: "Lakshmi", material: "Silver finish" }),
  P("rudraksha-bracelet-box", "Rudraksha Bracelet Gift Box", "spiritual-gifts", "mala", "kumkum", 799, "Five-mukhi rudraksha bracelet with a certificate card.", { material: "Rudraksha" }),
  P("incense-gift-box", "Incense Gift Box — 6 Fragrances", "spiritual-gifts", "incense", "tulsi", 549, "Six fragrances of hand-rolled agarbatti with a holder.", { material: "Natural" }),
  P("pooja-thali-gift-set", "Pooja Thali Gift Set", "spiritual-gifts", "thali", "sandal", 1599, "Steel thali with diya, bell, kumkum box and incense holder.", { material: "Steel & brass" }),
  P("housewarming-kalash-set", "Griha Pravesh Kalash Set", "spiritual-gifts", "kalash", "saffron", 999, "Copper kalash, coconut cover, mango-leaf toran and kumkum for housewarming.", { material: "Copper", occasion: "Griha Pravesh" }),
  P("tulsi-mala-gift-pack", "Tulsi Mala Gift Pack", "spiritual-gifts", "mala", "tulsi", 349, "108-bead tulsi mala with a cloth gomukhi bag.", { material: "Tulsi wood", deity: "Krishna" }),
];
