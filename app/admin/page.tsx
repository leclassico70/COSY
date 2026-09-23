import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="font-display text-2xl font-black uppercase text-cosy-pink">Admin</h1>
      <ul className="mt-6 space-y-3">
        <li>
          <Link href="/admin/produits" className="font-semibold text-cosy-pink underline">
            Gérer le menu (produits &amp; catégories)
          </Link>
        </li>
        <li>
          <Link href="/admin/tables" className="font-semibold text-cosy-pink underline">
            Gérer les tables &amp; QR codes
          </Link>
        </li>
        <li>
          <Link href="/admin/fidelite" className="font-semibold text-cosy-pink underline">
            Programme fidélité
          </Link>
        </li>
        <li>
          <Link href="/cuisine" className="font-semibold text-cosy-pink underline">
            Écran cuisine (commandes en cours)
          </Link>
        </li>
      </ul>
    </div>
  );
}
