-- ============================================================
--  Spires Uren — tabel "urenregels" (uren schrijven per project)
--  Voer EENMALIG uit in Supabase: SQL Editor -> New query -> Run.
--
--  Meerdere regels per dag: elke regel = één project + omschrijving + uren.
--  (De overuren staan in de aparte tabel "overuren".)
-- ============================================================

create table if not exists public.urenregels (
  id            bigint generated always as identity primary key,
  aangemaakt_op timestamptz not null default now(),

  datum         date    not null,
  project       text,
  omschrijving  text,
  uren          numeric not null default 0
);

-- Row Level Security: alleen de ingelogde eigenaar mag erbij.
alter table public.urenregels enable row level security;

create policy "ingelogd mag lezen"       on public.urenregels for select to authenticated using (true);
create policy "ingelogd mag toevoegen"   on public.urenregels for insert to authenticated with check (true);
create policy "ingelogd mag bijwerken"   on public.urenregels for update to authenticated using (true) with check (true);
create policy "ingelogd mag verwijderen" on public.urenregels for delete to authenticated using (true);

create index if not exists urenregels_datum_idx on public.urenregels (datum);
