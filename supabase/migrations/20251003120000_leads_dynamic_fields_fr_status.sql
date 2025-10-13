-- Ensure core organization tables exist
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

-- Seed default organizations for existing users (using user id as org id)
insert into public.organizations (id, name)
select u.id, coalesce(u.raw_user_meta_data->>'company', u.email || ' Org')
from auth.users u
where not exists (
  select 1 from public.organizations o where o.id = u.id
);

insert into public.memberships (org_id, user_id, role)
select u.id, u.id, 'owner'
from auth.users u
where not exists (
  select 1
  from public.memberships m
  where m.org_id = u.id and m.user_id = u.id
);

-- Ensure products table exists before altering
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_type text not null,
  label text not null,
  enabled boolean not null default true,
  form_schema jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, product_type)
);

-- Add JSON schema column for dynamic forms
alter table public.products
  add column if not exists form_schema jsonb;

-- LEADS updates
alter table public.leads
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists extra_fields jsonb not null default '{}'::jsonb,
  add column if not exists product_type text;

-- Harmonise/contraint le statut en FR
alter table public.leads drop constraint if exists leads_status_check;
alter table public.leads drop constraint if exists leads_status_fr_check;

alter table public.leads
  alter column status drop default;

update public.leads
set status = case
  when status in ('Non éligible','À rappeler','Phoning','À recontacter','Programmer pré-visite','Éligible') then status
  when status = 'Non eligible' then 'Non éligible'
  when status = 'A rappeler' then 'À rappeler'
  when status = 'Phoning' then 'Phoning'
  when status = 'PHONING' then 'Phoning'
  when status = 'phoning' then 'Phoning'
  when status = 'A recontacter' then 'À recontacter'
  when status in ('Programmer Pre-visite', 'Programmer Pre Visite', 'Programmer pre-visite', 'Programmer pre visite') then 'Programmer pré-visite'
  when status in ('Eligible', 'ELIGIBLE') then 'Éligible'
  when status in ('Nouveau', 'NOUVEAU') then 'À rappeler'
  when status in ('Qualifié', 'QUALIFIED') then 'À recontacter'
  when status = 'RDV_PLANIFIE' then 'Programmer pré-visite'
  when status in ('Converti', 'CONVERTED') then 'Éligible'
  when status in ('Perdu', 'Clôturé', 'PERDU', 'CLOTURE', 'CLOTURÉ', 'ARCHIVED', 'ARCHIVE') then 'Non éligible'
  else 'À rappeler'
end;

update public.leads
set status = 'À rappeler'
where status is null;

alter table public.leads
  add constraint leads_status_fr_check
  check (status in ('Non éligible','À rappeler','Phoning','À recontacter','Programmer pré-visite','Éligible'));

alter table public.leads
  alter column status set default 'À rappeler';

-- Ensure ownership metadata is populated
update public.leads
set created_by = coalesce(created_by, user_id);

update public.leads
set assigned_to = coalesce(assigned_to, user_id);

update public.leads
set org_id = coalesce(org_id, user_id)
where org_id is null;

-- Indexes for faster lookups
create index if not exists leads_org_assigned_idx on public.leads (org_id, assigned_to);
create index if not exists leads_created_by_idx on public.leads (org_id, created_by);

-- Enable Row Level Security and refresh policies
alter table public.leads enable row level security;

drop policy if exists "Users can view their own leads" on public.leads;
drop policy if exists "Users can create their own leads" on public.leads;
drop policy if exists "Users can update their own leads" on public.leads;
drop policy if exists "Users can delete their own leads" on public.leads;
drop policy if exists leads_select on public.leads;
drop policy if exists leads_insert on public.leads;
drop policy if exists leads_update on public.leads;
drop policy if exists leads_delete on public.leads;

create policy leads_select on public.leads
for select using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.leads.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.leads.org_id
        and m.user_id = auth.uid()
    )
    and (public.leads.assigned_to = auth.uid() or public.leads.created_by = auth.uid())
  )
);

create policy leads_insert on public.leads
for insert with check (
  exists (
    select 1 from public.memberships m
    where m.org_id = public.leads.org_id
      and m.user_id = auth.uid()
  )
  and public.leads.created_by = auth.uid()
);

create policy leads_update on public.leads
for update using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.leads.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.leads.org_id
        and m.user_id = auth.uid()
    )
    and (public.leads.assigned_to = auth.uid() or public.leads.created_by = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.leads.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.leads.org_id
        and m.user_id = auth.uid()
    )
    and (public.leads.assigned_to = auth.uid() or public.leads.created_by = auth.uid())
  )
);

create policy leads_delete on public.leads
for delete using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.leads.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.leads.org_id
        and m.user_id = auth.uid()
    )
    and (public.leads.assigned_to = auth.uid() or public.leads.created_by = auth.uid())
  )
);

-- Apply similar logic to sites (chantiers)
alter table public.sites
  add column if not exists org_id uuid references public.organizations(id) on delete cascade,
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.sites
set created_by = coalesce(created_by, user_id);

update public.sites
set assigned_to = coalesce(assigned_to, user_id);

update public.sites
set org_id = coalesce(org_id, user_id)
where org_id is null;

create index if not exists sites_org_assigned_idx on public.sites (org_id, assigned_to);
create index if not exists sites_created_by_idx on public.sites (org_id, created_by);

alter table public.sites enable row level security;

drop policy if exists "Users can view their own sites" on public.sites;
drop policy if exists "Users can create their own sites" on public.sites;
drop policy if exists "Users can update their own sites" on public.sites;
drop policy if exists "Users can delete their own sites" on public.sites;
drop policy if exists sites_select on public.sites;
drop policy if exists sites_insert on public.sites;
drop policy if exists sites_update on public.sites;
drop policy if exists sites_delete on public.sites;

create policy sites_select on public.sites
for select using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.sites.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.sites.org_id
        and m.user_id = auth.uid()
    )
    and (public.sites.assigned_to = auth.uid() or public.sites.created_by = auth.uid())
  )
);

create policy sites_insert on public.sites
for insert with check (
  exists (
    select 1 from public.memberships m
    where m.org_id = public.sites.org_id
      and m.user_id = auth.uid()
  )
  and public.sites.created_by = auth.uid()
);

create policy sites_update on public.sites
for update using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.sites.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.sites.org_id
        and m.user_id = auth.uid()
    )
    and (public.sites.assigned_to = auth.uid() or public.sites.created_by = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.sites.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.sites.org_id
        and m.user_id = auth.uid()
    )
    and (public.sites.assigned_to = auth.uid() or public.sites.created_by = auth.uid())
  )
);

create policy sites_delete on public.sites
for delete using (
  exists (
    select 1
    from public.memberships m
    where m.org_id = public.sites.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
  or (
    exists (
      select 1 from public.memberships m
      where m.org_id = public.sites.org_id
        and m.user_id = auth.uid()
    )
    and (public.sites.assigned_to = auth.uid() or public.sites.created_by = auth.uid())
  )
);

-- Basic RLS for products to ensure org scoping
alter table public.products enable row level security;

drop policy if exists products_select on public.products;
drop policy if exists products_insert on public.products;
drop policy if exists products_update on public.products;
drop policy if exists products_delete on public.products;

create policy products_select on public.products
for select using (
  exists (
    select 1 from public.memberships m
    where m.org_id = public.products.org_id
      and m.user_id = auth.uid()
  )
);

create policy products_insert on public.products
for insert with check (
  exists (
    select 1 from public.memberships m
    where m.org_id = public.products.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

create policy products_update on public.products
for update using (
  exists (
    select 1 from public.memberships m
    where m.org_id = public.products.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
)
with check (
  exists (
    select 1 from public.memberships m
    where m.org_id = public.products.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

create policy products_delete on public.products
for delete using (
  exists (
    select 1 from public.memberships m
    where m.org_id = public.products.org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  )
);

