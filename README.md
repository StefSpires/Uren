# Spires Uren

Een persoonlijke overuren-registratie in dezelfde stijl als het Spires CRM.
Per week vul je per dag je **extra** uren in (bovenop de normale 8 uur per dag),
met een optionele notitie. De app houdt automatisch het weektotaal en je
totale saldo bij.

## Lokaal draaien

```bash
npm install
npm run dev
```

Open daarna de link die Vite toont (meestal http://localhost:5173).

Zonder verdere instellingen werkt de app meteen: je gegevens worden lokaal
in je browser opgeslagen (localStorage). Geen inloggen nodig.

## Koppelen aan Supabase (cloud + inloggen, optioneel)

Wil je je uren in de cloud bewaren — zodat ze ook op je telefoon en andere
apparaten staan, net als het CRM — dan koppel je Supabase:

1. Maak (of gebruik) een Supabase-project.
2. Open **SQL Editor → New query**, plak de inhoud van
   [`supabase/overuren.sql`](supabase/overuren.sql) en klik **Run**.
3. Maak in Supabase een gebruiker aan (Authentication → Users) met je e-mail
   en een wachtwoord.
4. Zet de sleutels in een bestand `.env.local` in deze map:

   ```
   VITE_SUPABASE_URL=https://JOUW-PROJECT.supabase.co
   VITE_SUPABASE_KEY=jouw-anon-public-key
   ```

5. Herstart `npm run dev`. De app vraagt nu eerst om inloggen en bewaart
   alles in Supabase.

> Zodra de sleutels aanwezig zijn schakelt de app automatisch over van
> browser-opslag naar Supabase — je hoeft verder niets in de code te wijzigen.

## Bouwen voor productie

```bash
npm run build
```

De statische site komt in `dist/` te staan (bv. te hosten via Vercel).
