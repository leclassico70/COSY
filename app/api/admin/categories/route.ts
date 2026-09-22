import { requireStaff } from "@/lib/supabase/requireStaff";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import type { Categorie } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { nom: string; emoji?: string; ordre: number };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("categories").insert({
    nom: body.nom,
    emoji: body.emoji ?? null,
    ordre: body.ordre,
  });

  if (error) return Response.json({ error: "création impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 201 });
}

export async function PATCH(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { id: string } & Partial<Categorie>;
  const { id, ...champs } = body;

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("categories").update(champs).eq("id", id);

  if (error) return Response.json({ error: "mise à jour impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}

export async function DELETE(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { id: string };

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("categories").delete().eq("id", body.id);

  if (error) return Response.json({ error: "suppression impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 200 });
}
