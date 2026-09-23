import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { formatPrix } from "@/lib/money";

export default async function MenuPage() {
  const supabase = await createSupabaseServerClient();

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .order("ordre", { ascending: true });

  const { data: produits, error: produitsError } = await supabase
    .from("produits")
    .select("*")
    .order("ordre", { ascending: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-3xl font-black uppercase text-cosy-pink">Notre menu</h1>

      {/* DIAGNOSTIC TEMPORAIRE — à retirer une fois le problème de déploiement résolu */}
      <pre className="mt-4 whitespace-pre-wrap rounded bg-black/80 p-3 text-xs text-lime-300">
        {JSON.stringify(
          {
            url_present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
            url_prefix: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").slice(0, 30),
            anon_key_present: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
            anon_key_length: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").length,
            categories_count: categories?.length ?? null,
            categories_error: categoriesError,
            produits_count: produits?.length ?? null,
            produits_error: produitsError,
          },
          null,
          2
        )}
      </pre>

      {(categories ?? []).map((categorie) => {
        const produitsCategorie = (produits ?? []).filter((p) => p.categorie_id === categorie.id);
        if (produitsCategorie.length === 0) return null;

        return (
          <section key={categorie.id} className="mt-10">
            <h2 className="font-display text-xl font-extrabold">
              {categorie.emoji} {categorie.nom}
            </h2>
            <ul className="mt-4 divide-y divide-cosy-pink/10">
              {produitsCategorie.map((produit) => (
                <li key={produit.id} className="flex items-start gap-4 py-3">
                  {produit.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={produit.photo_url}
                      alt={produit.nom}
                      className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="flex flex-1 items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">
                        {produit.nom}
                        {!produit.disponible && (
                          <span className="ml-2 text-xs font-normal uppercase text-cosy-ink/40">
                            Indisponible
                          </span>
                        )}
                      </p>
                      {produit.description && (
                        <p className="text-sm text-cosy-ink/60">{produit.description}</p>
                      )}
                    </div>
                    <p className="whitespace-nowrap font-display font-bold text-cosy-pink">
                      {formatPrix(produit.prix_centimes)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
