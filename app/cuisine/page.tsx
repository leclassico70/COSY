import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { CuisineClient } from "./CuisineClient";

export default async function CuisinePage() {
  const supabase = await createSupabaseServerClient();

  const { data: commandes } = await supabase
    .from("commandes")
    .select("*")
    .neq("statut", "prete")
    .order("created_at", { ascending: true });

  const { data: lignes } = await supabase.from("commande_lignes").select("*");
  const { data: tables } = await supabase.from("tables").select("*");

  return (
    <CuisineClient
      commandesInitiales={commandes ?? []}
      lignes={lignes ?? []}
      tables={tables ?? []}
    />
  );
}
