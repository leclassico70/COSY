import Link from "next/link";

export default function AccueilPage() {
  return (
    <div>
      <section className="bg-cosy-pink px-4 py-20 text-center text-white">
        <h1 className="font-display text-4xl font-black uppercase tracking-tight sm:text-6xl">
          Bienvenue chez Cosy
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg font-semibold">
          Des donuts qui donnent le sourire — café, pâtisseries maison, bagels, crêpes et
          milkshakes à Montbéliard.
        </p>
        <Link
          href="/menu"
          className="mt-8 inline-block rounded-pill bg-white px-8 py-3 font-display font-extrabold uppercase text-cosy-pink"
        >
          Voir le menu
        </Link>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-4 py-16 sm:grid-cols-4">
        {[
          { titre: "Café d'exception", desc: "Torréfaction sélectionnée" },
          { titre: "Pâtisseries maison", desc: "Faites sur place chaque jour" },
          { titre: "Snacking gourmand", desc: "Bagels, toasts, salades" },
          { titre: "Un lieu convivial", desc: "Sur place ou à emporter" },
        ].map((item) => (
          <div key={item.titre} className="text-center">
            <p className="font-display font-extrabold uppercase text-cosy-pink">{item.titre}</p>
            <p className="mt-1 text-sm text-cosy-ink/70">{item.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
