"use client"

import React from "react"
import { Text } from "@medusajs/ui"

export default function PrivacyPolicyPage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-4xl md:text-5xl font-semibold mb-6">Persondatapolitik for 10shirts</h1>

      <div className="prose prose-lg dark:prose-invert mb-8 max-w-none">
        <p>Denne persondatapolitik beskriver, hvordan 10shirts indsamler og behandler dine personoplysninger, når du handler hos os eller besøger vores hjemmeside 10shirtss.dk.</p>

        <section>
          <h2 className="font-semibold text-3xl">1. Dataansvarlig</h2>
          <p>Den juridiske enhed, der er ansvarlig for behandlingen af dine personoplysninger, er:</p>
          <address>
            <p><strong>10shirts I/S</strong> – Ørnevej 38, 2400 København NV</p>
            <p><strong>CVR-nr.:</strong> 46081080</p>
            <p className="mb-4"><strong>E-mail:</strong> <a href="mailto:10shirtsdk@gmail.com">10shirtsdk@gmail.com</a></p>
          </address>
        </section>

        <section>
          <h2 className="font-semibold text-3xl">2. Hvilke oplysninger indsamler vi?</h2>
          <p>Vi indsamler kun de oplysninger, der er nødvendige for at kunne handle med dig. Det drejer sig typisk om:</p>
          <ul>
            <li><strong>Almindelige personoplysninger:</strong> Navn, adresse, e-mail, telefonnummer.</li>
            <li><strong>Betalingsoplysninger:</strong> Transaktionsdata (vi gemmer ikke dine kortoplysninger; disse håndteres krypteret af vores betalingsudbyder).</li>
            <li><strong>Købshistorik:</strong> Hvilke varer du har købt og returneret.</li>
            <li className="mb-4"><strong>Digitale spor:</strong> IP-adresse og adfærd på websitet (via cookies).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-3xl">3. Formålet med indsamlingen</h2>
          <p>Vi bruger dine oplysninger til følgende formål:</p>
          <ul>
            <li><strong>Behandling af din ordre:</strong> For at kunne sende dine varer, sende ordrebekræftelser og håndtere eventuelle retursager.</li>
            <li><strong>Kundeservice:</strong> For at kunne besvare dine spørgsmål via mail eller chat.</li>
            <li><strong>Lovkrav:</strong> For at overholde Bogføringsloven.</li>
            <li><strong>Markedsføring:</strong> Kun hvis du eksplicit har givet samtykke (f.eks. tilmelding til nyhedsbrev).</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold text-3xl">4. Hvem deler vi dine oplysninger med?</h2>
          <p>Vi sælger aldrig dine data. Vi videregiver kun oplysninger til samarbejdspartnere, der er nødvendige for at drive forretningen (databehandlere), f.eks.:</p>
          <ul>
            <li>Fragtfirmaer (f.eks. GLS, PostNord, DAO) så de kan levere din pakke.</li>
            <li>Betalingsindløsere (f.eks. Stripe, MobilePay, Nets) til sikker betaling.</li>
            <li>Tekniske partnere (f.eks. hostingudbyder).</li>
          </ul>
          <p>Vi har indgået databehandleraftaler med alle vores partnere for at sikre, at dine data er beskyttet.</p>
        </section>

        <section>
          <h2 className="font-semibold text-3xl">5. Hvor længe gemmer vi dine data?</h2>
          <p><strong>Købsoplysninger:</strong> Vi gemmer fakturaer og ordreoplysninger i 5 år fra udgangen af det regnskabsår, købet er foretaget i (Bogføringsloven §10). Herefter slettes eller anonymiseres oplysningerne.</p>
          <p><strong>Nyhedsbrev:</strong> Vi gemmer din e-mail, så længe du er tilmeldt. Du kan til enhver tid afmelde dig via linket i bunden af nyhedsbrevet.</p>
        </section>

        <section>
          <h2 className="font-semibold text-3xl">6. Dine rettigheder</h2>
          <p>I henhold til persondataforordningen har du en række rettigheder:</p>
          <ul>
            <li>Ret til indsigt: Du kan bede om at se, hvilke data vi har om dig.</li>
            <li>Ret til berigtigelse: Du kan få rettet forkerte oplysninger.</li>
            <li>Ret til sletning: I særlige tilfælde kan du få slettet oplysninger om dig (dog ikke data omfattet af Bogføringsloven).</li>
            <li>Ret til at trække samtykke tilbage (f.eks. ved nyhedsbreve).</li>
          </ul>
          <p>Hvis du vil gøre brug af dine rettigheder, skal du kontakte os på <a href="mailto:10shirtsdk@gmail.com">10shirtsdk@gmail.com</a>.</p>
        </section>

        <section>
          <h2 className="font-semibold text-3xl">7. Klagemulighed</h2>
          <p>Hvis du er utilfreds med den måde, vi behandler dine personoplysninger på, har du ret til at indgive en klage til Datatilsynet:</p>
          <address>
            <p><br/>Carl Jacobsens Vej 35<br/>2500 Valby</p>
            <p><a href="https://www.datatilsynet.dk" target="_blank" rel="noreferrer">www.datatilsynet.dk</a></p>
          </address>
        </section>
      </div>

      <section className="mt-8">
        <h2 className="text-xl font-medium mb-2">Information We Collect</h2>
        <p className="text-sm text-muted-foreground">Describe what you collect and why.</p>
      </section>
    </main>
  )
}
