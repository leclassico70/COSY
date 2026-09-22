import { requireStaff } from "@/lib/supabase/requireStaff";
import { createSupabaseServiceClient } from "@/lib/supabase/serviceClient";
import { slugForTable } from "@/lib/tableSlug";

export async function POST(request: Request) {
  const staff = await requireStaff();
  if (!staff) return Response.json({ error: "authentification requise" }, { status: 401 });

  const body = (await request.json()) as { numero: number };

  if (!Number.isInteger(body.numero) || body.numero <= 0) {
    return Response.json({ error: "numéro de table invalide" }, { status: 400 });
  }

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("tables").insert({
    numero: body.numero,
    slug: slugForTable(body.numero),
  });

  if (error) return Response.json({ error: "création impossible" }, { status: 500 });
  return Response.json({ ok: true }, { status: 201 });
}
