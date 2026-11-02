import Logo from "@/components/Logo";

// Placeholder shell. Navbar, footer and homepage sections become CMS-driven in Stages 4, 5 and 7.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
      <Logo />
      <div className="divider-gold" />
      <p className="max-w-md text-muted">Our storefront is being prepared. Please check back soon.</p>
    </main>
  );
}
