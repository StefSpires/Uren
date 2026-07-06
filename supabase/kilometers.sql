-- ============================================================
--  Spires Uren — tabel "kilometers"
--  Voer EENMALIG uit in Supabase: SQL Editor -> New query -> Run.
--
--  Eén regel per dag: de datum + het aantal gereden kilometers,
--  met een optionele notitie/route.
-- ============================================================

create table if not exists public.kilometers (
  id            bigint generated always as identity primary key,
  aangemaakt_op timestamptz not null default now(),

  datum         date    not null unique,   -- unique: per dag één regel (de app doet 'upsert' op datum)
  km            numeric not null default 0,
  notitie       text
);

-- Row Level Security: alleen de ingelogde eigenaar mag erbij.
alter table public.kilometers enable row level security;

create policy "ingelogd mag lezen"       on public.kilometers for select to authenticated using (true);
create policy "ingelogd mag toevoegen"   on public.kilometers for insert to authenticated with check (true);
create policy "ingelogd mag bijwerken"   on public.kilometers for update to authenticated using (true) with check (true);
create policy "ingelogd mag verwijderen" on public.kilometers for delete to authenticated using (true);

create index if not exists kilometers_datum_idx on public.kilometers (datum);
