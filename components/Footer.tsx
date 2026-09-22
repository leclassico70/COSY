export function Footer() {
  return (
    <footer className="mt-16 border-t border-cosy-pink/20 bg-white py-8 text-sm text-cosy-ink/70">
      <div className="mx-auto max-w-5xl px-4">
        <p className="font-display font-bold text-cosy-ink">Cosy Café &amp; Cie</p>
        <p>4 Rue des Febvres, 25200 Montbéliard</p>
        <p className="mt-2">© {new Date().getFullYear()} Cosy Café &amp; Cie</p>
      </div>
    </footer>
  );
}
