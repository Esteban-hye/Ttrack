-- Ttrack : tables de synchronisation.
-- À exécuter une fois dans Supabase → SQL Editor (peut être le même projet que Tmoney).

-- Clé maîtresse chiffrée (le serveur ne peut pas la déchiffrer)
create table if not exists public.ttrack_meta (
  user_id uuid primary key references auth.users on delete cascade,
  salt text not null,
  wrapped_key text not null,
  recovery_wrapped text not null,
  created_at timestamptz not null default now()
);

-- Une ligne par aliment / plat / entrée du journal / pesée, contenu chiffré
create table if not exists public.ttrack_records (
  user_id uuid not null references auth.users on delete cascade,
  id text not null,
  kind text not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  payload text,
  primary key (user_id, id)
);
create index if not exists ttrack_records_user_updated on public.ttrack_records (user_id, updated_at);

alter table public.ttrack_meta enable row level security;
alter table public.ttrack_records enable row level security;

-- Chaque compte ne voit et ne modifie que ses propres lignes
drop policy if exists ttrack_meta_own on public.ttrack_meta;
create policy ttrack_meta_own on public.ttrack_meta
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ttrack_records_own on public.ttrack_records;
create policy ttrack_records_own on public.ttrack_records
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
