-- ============================================================
--  Spires Uren — tabel "overuren"
--  Voer EENMALIG uit in Supabase: SQL Editor -> New query -> Run.
--
--  Eén regel per dag: de datum + het aantal extra uren (overuren)
--  bovenop de normale 8 uur, met een optionele notitie.
-- ============================================================

create table if not exists public.overuren (
  id            bigint generated always as identity primary key,
  aangemaakt_op timestamptz not null default now(),

  datum         date        not null unique,   -- unique: per dag één regel (de app doet 'upsert' op datum)
  uren          numeric      not null default 0, -- extra uren, mag halve uren en negatief zijn (bijv. 1.5 of -2)
  notitie       text
);

-- Row Level Security: alleen de ingelogde eigenaar mag erbij.
alter table public.overuren enable row level security;

create policy "ingelogd mag lezen"       on public.overuren for select to authenticated using (true);
create policy "ingelogd mag toevoegen"   on public.overuren for insert to authenticated with check (true);
create policy "ingelogd mag bijwerken"   on public.overuren for update to authenticated using (true) with check (true);
create policy "ingelogd mag verwijderen" on public.overuren for delete to authenticated using (true);

create index if not exists overuren_datum_idx on public.overuren (datum);
