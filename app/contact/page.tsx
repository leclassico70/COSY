export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="font-display text-3xl font-black uppercase text-cosy-pink">
        Contact &amp; horaires
      </h1>

      <div className="mt-8 space-y-6">
        <div>
          <h2 className="font-display font-extrabold">Adresse</h2>
          <p>4 Rue des Febvres, 25200 Montbéliard</p>
        </div>

        <div>
          <h2 className="font-display font-extrabold">Horaires</h2>
          <ul className="mt-1 space-y-1 text-cosy-ink/80">
            <li>Lundi – Vendredi : 8h00 – 19h00</li>
            <li>Samedi : 9h00 – 19h00</li>
            <li>Dimanche : 9h00 – 13h00</li>
          </ul>
        </div>

        <div>
          <h2 className="font-display font-extrabold">Nous contacter</h2>
          <p>
            <a href="tel:+33300000000" className="text-cosy-pink underline">
              03 00 00 00 00
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
