import { createSupabaseServerClient } from "@/lib/supabase/serverClient";
import { buildTableOrderUrl } from "@/lib/tableSlug";
import { generateQrCodeDataUrl } from "@/lib/qrcode";
import { TablesClient } from "./TablesClient";

export default async function AdminTablesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: tables } = await supabase.from("tables").select("*").order("numero");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const tablesAvecQr = await Promise.all(
    (tables ?? []).map(async (table) => ({
      table,
      qrDataUrl: await generateQrCodeDataUrl(buildTableOrderUrl(siteUrl, table.slug)),
    }))
  );

  return <TablesClient tablesAvecQr={tablesAvecQr} />;
}
