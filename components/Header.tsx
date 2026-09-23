import Link from "next/link";

export function Header() {
  return (
    <header className="bg-cosy-pink text-white">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 py-3 sm:flex-row sm:justify-between sm:gap-4 sm:py-4">
        <Link href="/" className="font-display text-xl font-extrabold tracking-wide sm:text-2xl">
          Cosy <span className="font-normal">Café &amp; Cie</span>
        </Link>
        <nav className="flex gap-4 text-xs font-semibold uppercase tracking-wide sm:gap-6 sm:text-sm">
          <Link href="/">Accueil</Link>
          <Link href="/menu">Menu</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/compte">Mon compte</Link>
        </nav>
      </div>
    </header>
  );
}
