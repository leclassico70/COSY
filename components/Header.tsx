import Link from "next/link";

export function Header() {
  return (
    <header className="bg-cosy-pink text-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-display text-2xl font-extrabold tracking-wide">
          Cosy <span className="font-normal">Café &amp; Cie</span>
        </Link>
        <nav className="flex gap-6 text-sm font-semibold uppercase tracking-wide">
          <Link href="/">Accueil</Link>
          <Link href="/menu">Menu</Link>
          <Link href="/contact">Contact</Link>
        </nav>
      </div>
    </header>
  );
}
