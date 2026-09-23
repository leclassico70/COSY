import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { ProduitsClient } from "./ProduitsClient";

export default async function AdminProduitsPage() {
  const supabase = await createSupabaseServerClient();

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("ordre", { ascending: true });

  const { data: produits } = await supabase
    .from("produits")
    .select("*")
    .order("ordre", { ascending: true });

  return <ProduitsClient categoriesInitiales={categories ?? []} produitsInitiaux={produits ?? []} />;
}
