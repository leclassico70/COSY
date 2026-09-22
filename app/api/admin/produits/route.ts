import { requireStaff } from "@/lib/supabase/requireStaff";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import type { Produit } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as {
    categorieId: string;
    nom: string;
    description: string;
    prixCentimes: number;
    photoUrl?: string | null;
  };

  if (!body.nom || !body.nom.trim()) {
    return Response.json({ error: "nom requis" }, { status: 400 });
  }
  if (!Number.isInteger(body.prixCentimes) || body.prixCentimes < 0) {
    return Response.json({ error: "prix invalide" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("produits").insert({
    categorie_id: body.categorieId,
    nom: body.nom,
    description: body.description,
    prix_centimes: body.prixCentimes,
    photo_url: body.photoUrl ?? null,
    disponible: true,
  });

  if (error) return Response.json({ error: "création impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { id: string } & Partial<Produit>;
  const { id, ...champs } = body;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("produits").update(champs).eq("id", id);

  if (error) return Response.json({ error: "mise à jour impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { id: string };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("produits").delete().eq("id", body.id);

  if (error) return Response.json({ error: "suppression impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}
