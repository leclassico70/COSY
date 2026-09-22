import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { FideliteClient } from "./FideliteClient";

export default async function AdminFidelitePage() {
  const supabase = await createSupabaseServerClient();

  const { data: parametres } = await supabase
    .from("parametres_fidelite")
    .select("points_requis, montant_minimum_centimes, valeur_bon_centimes")
    .single();

  return (
    <FideliteClient
      parametresInitiaux={
        parametres ?? { points_requis: 10, montant_minimum_centimes: 500, valeur_bon_centimes: 1000 }
      }
    />
  );
}
