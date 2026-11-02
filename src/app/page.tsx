import Logo from "@/components/Logo";

const offerings = [
  { title: "Graha Shanti", text: "Planetary harmony rituals performed by learned pandits." },
  { title: "Satyanarayan Katha", text: "Bring prosperity and peace to your home." },
  { title: "Rudrabhishek", text: "Sacred abhishek of Lord Shiva with Vedic mantras." },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-surface"><div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <a href="/" aria-label="GodPuja home"><Logo /></a>
        <nav className="hidden gap-8 text-sm text-muted sm:flex">
          <a href="#pujas" className="hover:text-primary">Pujas</a>
          <a href="#about" className="hover:text-primary">About</a>
          <a href="#contact" className="hover:text-primary">Contact</a>
        </nav>
      </div></header>

      <section className="mx-auto flex max-w-3xl flex-1 flex-col items-center px-6 py-24 text-center">
        <span className="mb-6 text-4xl text-accent">ॐ</span>
        <h1 className="text-5xl font-medium leading-tight sm:text-6xl">
          Sacred rituals, <span className="text-primary">made simple</span>
        </h1>
        <div className="divider-gold my-8" />
        <p className="max-w-xl text-lg text-muted">
          Book authentic pujas performed by experienced pandits, and invite
          peace, prosperity and blessings into your life.
        </p>
        <div className="mt-10 flex gap-3">
          <a href="#pujas" className="btn-primary">Book a Puja</a>
          <a href="#about" className="btn-outline">Learn more</a>
        </div>
      </section>

      <section id="pujas" className="mx-auto grid w-full max-w-5xl gap-6 px-6 pb-24 sm:grid-cols-3">
        {offerings.map((o) => (
          <div key={o.title} className="card p-6">
            <h3 className="text-2xl font-semibold">{o.title}</h3>
            <p className="mt-2 text-sm text-muted">{o.text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
