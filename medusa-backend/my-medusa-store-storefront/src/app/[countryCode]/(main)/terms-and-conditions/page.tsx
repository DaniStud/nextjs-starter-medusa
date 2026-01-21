"use client"

import React from "react"
import { Text } from "@medusajs/ui"


export default function TermsAndConditionsPage() {
  return (
    <main className="max-w-4xl mx-auto py-12 px-6">
      <h1 className="text-3xl md:text-5xl font-semibold mb-6 uppercase">Handelsbetingelser for 10shirts I/S</h1>

      <div className="prose prose-lg dark:prose-invert mb-8 max-w-none">
        <section>
          <h2 className="font-semibold text-3xl uppercase">1. Generelle oplysninger</h2>
          <p>Disse salgs- og leveringsbetingelser gælder for køb af varer på 10shirtss.dk til levering i Danmark.</p>
        
          <h3 className="font-semibold mt-6 uppercase">Virksomhedsoplysninger</h3>
          <address className="mb-4">
            <p><strong>Navn:</strong> 10shirts I/S</p>
            <p><strong>CVR-nr:</strong> 46081080</p>
            <p><strong>Adresse:</strong> Ørnevej 38, 2400 København NV</p>
            <p><strong>E-mail:</strong> <a href="mailto:10shirtsdk@gmail.com">10shirtsdk@gmail.com</a></p>
          </address>
        </section>

        <section>
          <h2 className="font-semibold text-3xl uppercase">2. Betaling</h2>
          <p>Hos 10shirts I/S modtager vi betaling med følgende kort og betalingsmetoder:</p>
          <ul>
            <li>Dankort / VISA-Dankort</li>
            <li>VISA / VISA Electron</li>
            <li>Mastercard</li>
            <li>MobilePay</li>
            <li>ApplePay</li>
          </ul>
          <p className="mt-6 mb-4">Beløbet hæves først på dit kort, når varen afsendes fra vores lager. Vi tager ikke kortgebyrer. Alle priser er i danske kroner (DKK) og er inklusiv 25% moms.</p>
        </section>

        <section>
          <h2 className="font-semibold text-3xl uppercase">3. Levering</h2>
          <p>Vi leverer dine t-shirts med PostNord.</p>
          <p>Leveringstid: Vores typiske leveringstid er 3-5 hverdage.</p>
          <h3 className="font-semibold mt-6">Fragtpriser</h3>
          <ul>
            <li>Levering til pakkeshop: 49 kr.</li>
            <li>Levering til privatadresse: 59 kr.</li>
            <li>Gratis fragt ved køb over 499 kr.</li>
          </ul>
          <p className="mt-4 mb-4">Du modtager et track &amp; trace-nummer pr. mail, så snart din pakke er afsendt.</p>
        </section>

        <section>
          <h2 className="font-semibold text-3xl uppercase">4. Fortrydelsesret </h2>
          <p className="mb-4">Du har som forbruger 14 dages fortrydelsesret, når du handler hos os. Fortrydelsesfristen udløber 14 dage efter den dag, du har modtaget din vare.</p>
          <p className="mb-4"><strong>Sådan fortryder du:</strong> Du skal inden 14 dage fra modtagelse give os meddelelse om, at du ønsker at fortryde dit køb. Meddelelsen skal sendes på mail til <a href="mailto:10shirtsdk@gmail.com">10shirtsdk@gmail.com</a>. I din meddelelse skal du gøre os tydeligt opmærksom på, at du ønsker at udnytte din fortrydelsesret.</p>
          <p className="mb-4"><strong>Returnering:</strong> Du skal sende din ordre retur til os uden unødig forsinkelse, og senest 14 dage efter du har meddelt os, at du ønsker at fortryde dit køb. Du skal selv afholde de direkte udgifter i forbindelse med varens returforsendelse. Du bærer risikoen for varen fra tidspunktet for varens levering.</p>
          <p><strong>Varens stand, når du sender den retur:</strong> Du hæfter kun for eventuel forringelse af varens værdi, som skyldes anden håndtering, end hvad der er nødvendigt for at fastslå varens art, egenskaber og den måde, den fungerer på. Med andre ord – du kan prøve tøjet på samme måde, som hvis du prøvede det i en fysisk butik, men du må ikke tage det i egentlig brug. Hvis varen er prøvet udover hvad der er beskrevet ovenfor, betragter vi den som brugt, hvilket betyder, at du ved fortrydelse af købet kun får en del eller intet af købsbeløbet retur.</p>
        </section>

        <section>
          <h2 className=" font-semibold mt-6 text-3xl uppercase">5. Reklamationsret</h2>
          <p className="mb-4">Når du handler hos os som forbruger, gælder købelovens regler for varekøb. Du har 24 måneders reklamationsret. Det betyder, at du enten kan få varen repareret, ombyttet, pengene tilbage eller afslag i prisen, afhængig af den konkrete situation. Det er et krav, at reklamationen er berettiget, og at manglen ikke er opstået som følge af fejlagtig brug af produktet (f.eks. vask ved forkert temperatur) eller anden skadeforvoldende adfærd.</p>
          <p className="mb-4"><strong>Sådan reklamerer du:</strong> Kontakt os på mail <a href="mailto:10shirtsdk@gmail.com">10shirtsdk@gmail.com</a> og beskriv problemet. Vedhæft gerne billeder af fejlen. Hvis reklamationen er berettiget, refunderer vi dine (rimelige) fragtomkostninger.</p>
          <p className="mb-4"><strong>Varen sendes til:</strong> 10shirts I/S Ørnevej 38, 2400 København NV</p>
        </section>

        <section>
          <h2 className="font-semibold text-3xl uppercase">6. Persondatapolitik</h2>
          <p>For at du kan indgå aftale med os, har vi brug for følgende oplysninger: Navn, adresse, tlf.nr. og e-mailadresse. Vi foretager registreringen af dine personoplysninger med det formål at kunne levere varen til dig. Personoplysningerne registreres hos 10shirts I/S og opbevares i fem år, hvorefter oplysningerne slettes. Vi videregiver eller sælger ikke dine oplysninger til tredjemand.</p>
        </section>

        <section>
          <h2 className="font-semibold mt-6 text-3xl uppercase">7. Klageadgang</h2>
          <p>Hvis du vil klage over dit køb, skal du rette henvendelse til <a href="mailto:10shirtsdk@gmail.com">10shirtsdk@gmail.com</a>. Hvis det ikke lykkes os at finde en løsning, kan du indgive en klage til Nævnenes Hus, Toldboden 2, 8800 Viborg via Klageportalen for Nævnenes Hus.</p>
        </section>
      </div>
    </main>
  )
}