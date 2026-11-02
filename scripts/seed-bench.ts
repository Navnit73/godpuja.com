// Seeds a SEPARATE benchmark database (godpuja_bench) with the PRD §9 data set: 1,000 active products across a
// 3-level category tree, a homepage with product rails, a menu and a footer. Never touches the main database.
// Usage: npx tsx scripts/seed-bench.ts          (then run the app with MONGODB_URI pointing at godpuja_bench)
import { config } from "dotenv";
config({ path: ".env.local", override: true });
const base = new URL(process.env.MONGODB_URI ?? "");
base.pathname = "/godpuja_bench";
process.env.MONGODB_URI = base.toString();

import mongoose from "mongoose";
import { connectDB } from "../src/server/db";
import { Category } from "../src/server/models/Category";
import { Product } from "../src/server/models/Product";
import { Homepage } from "../src/server/models/Homepage";
import { User } from "../src/server/models/User";
import { hashPassword } from "../src/server/auth/password";

const N = Number(process.env.BENCH_PRODUCTS ?? 1000);
const WORDS = ["Brass", "Copper", "Silver", "Diya", "Kalash", "Agarbatti", "Dhoop", "Puja", "Thali", "Ganesh", "Lakshmi", "Shiva", "Rudraksha", "Mala", "Sandal", "Kumkum", "Haldi", "Camphor", "Ghee", "Bell", "Lamp", "Kit", "Idol", "Chowki", "Aasan"];
const IMG = "https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg";
const pick = (i: number, k: number) => WORDS[(i * 7 + k * 13) % WORDS.length];

async function main() {
  await connectDB();
  const db = mongoose.connection;
  if (db.name !== "godpuja_bench") throw new Error(`Refusing to seed ${db.name}`);
  await db.dropDatabase();
  await Promise.all([Category.syncIndexes(), Product.syncIndexes(), Homepage.syncIndexes(), User.syncIndexes()]);

  // 5 top-level categories x 3 children x 2 grandchildren = 45 categories.
  const leaves: { _id: mongoose.Types.ObjectId; path: string }[] = [];
  const tops = ["puja-kits", "idols", "lamps-diyas", "incense", "festival"];
  for (const [ti, t] of tops.entries()) {
    const top = await Category.create({ name: t.replace(/-/g, " "), slug: t, path: t, level: 1, order: ti });
    for (let c = 0; c < 3; c++) {
      const cs = `${t}-sub-${c}`;
      const child = await Category.create({ name: `${t} ${c}`, slug: cs, path: `${t}/${cs}`, parent: top._id, level: 2, order: c });
      leaves.push({ _id: child._id, path: child.path });
      for (let g = 0; g < 2; g++) {
        const gs = `${cs}-leaf-${g}`;
        const leaf = await Category.create({ name: `${t} ${c}.${g}`, slug: gs, path: `${t}/${cs}/${gs}`, parent: child._id, level: 3, order: g });
        leaves.push({ _id: leaf._id, path: leaf.path });
      }
    }
  }

  const docs = Array.from({ length: N }, (_, i) => {
    const name = `${pick(i, 0)} ${pick(i, 1)} ${pick(i, 2)} ${i + 1}`;
    const price = 9900 + ((i * 3779) % 400) * 100;
    const salePrice = i % 4 === 0 ? price - 1000 : undefined;
    const hasVariants = i % 5 === 0;
    return {
      name, slug: `bench-product-${i + 1}`, sku: `BENCH-${i + 1}`,
      shortDescription: `${pick(i, 3)} ${pick(i, 4)} for daily puja and festivals.`,
      description: `## About\n\nHandmade ${name.toLowerCase()}.\n\n- Pure material\n- Traditional design`,
      images: [{ url: IMG, alt: name, order: 0 }],
      category: leaves[i % leaves.length]._id,
      brand: i % 3 ? "GodPuja" : "Shubh",
      price, salePrice, effectivePrice: salePrice ?? price,
      stock: hasVariants ? 0 : (i % 17 === 0 ? 0 : 20 + (i % 50)),
      status: "active", isFeatured: i % 25 === 0, soldCount: (i * 31) % 500,
      variants: hasVariants ? [{ sku: `BENCH-${i + 1}-S`, options: { Size: "Small" }, stock: 10 }, { sku: `BENCH-${i + 1}-L`, options: { Size: "Large" }, price: price + 5000, stock: 5 }] : [],
      attributes: [{ name: "Material", value: pick(i, 0) }],
      createdAt: new Date(Date.now() - i * 60_000), updatedAt: new Date(Date.now() - i * 60_000),
    };
  });
  for (let i = 0; i < docs.length; i += 250) await Product.insertMany(docs.slice(i, i + 250), { timestamps: false });

  const id = () => new mongoose.Types.ObjectId().toString();
  await Homepage.create({
    key: "main",
    sections: [
      { id: id(), type: "hero", enabled: true, data: { heading: "Everything for your puja", subheading: "Benchmark data set", imageUrl: IMG, imageAlt: "Puja items", ctaLabel: "Shop kits", ctaUrl: "/category/puja-kits", secondaryCtaLabel: "", secondaryCtaUrl: "" } },
      { id: id(), type: "featuredProducts", enabled: true, data: { heading: "Featured", category: "", limit: 8 } },
      { id: id(), type: "latestProducts", enabled: true, data: { heading: "New arrivals", category: "", limit: 8 } },
      { id: id(), type: "bestSellers", enabled: true, data: { heading: "Best sellers", category: "puja-kits", limit: 8 } },
    ],
  });

  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@godpuja.com";
  await User.create({ name: "Super Admin", email, passwordHash: await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!12345"), role: "superadmin" });

  console.log(`Seeded godpuja_bench: ${await Category.countDocuments()} categories, ${await Product.countDocuments()} products.`);
  console.log(`Sample category: /category/${leaves[0].path}  ·  sample product: /product/bench-product-1`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
