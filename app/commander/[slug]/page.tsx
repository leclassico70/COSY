import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { CommandeClient } from "./CommandeClient";

export default async function CommanderPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: table } = await supabase
    .from("tables")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!table) {
    notFound();
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("*")
    .order("ordre", { ascending: true });

  const { data: produits } = await supabase
    .from("produits")
    .select("*")
    .eq("disponible", true)
    .order("ordre", { ascending: true });

  return (
    <CommandeClient
      table={table}
      categories={categories ?? []}
      produits={produits ?? []}
    />
  );
}
