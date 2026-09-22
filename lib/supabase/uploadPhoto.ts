import "server-only";
import { createSupabaseServiceClient } from "./serviceClient";

export async function uploadProduitPhoto(fichier: File, nomFichier: string): Promise<string> {
  const supabase = createSupabaseServiceClient();

  const { error } = await supabase.storage
    .from("produits-photos")
    .upload(nomFichier, fichier, { upsert: true, contentType: fichier.type });

  if (error) {
    throw new Error(`Échec de l'upload de la photo : ${error.message}`);
  }

  const { data } = supabase.storage.from("produits-photos").getPublicUrl(nomFichier);
  return data.publicUrl;
}
