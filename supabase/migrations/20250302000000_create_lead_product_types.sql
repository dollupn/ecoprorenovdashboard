create table if not exists public.lead_product_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lead_product_types enable row level security;

create index if not exists lead_product_types_org_idx on public.lead_product_types (org_id);
create unique index if not exists lead_product_types_org_name_idx on public.lead_product_types (org_id, lower(name));

create trigger update_lead_product_types_updated_at
  before update on public.lead_product_types
  for each row
  execute function public.update_updated_at_column();

create policy if not exists lead_product_types_select on public.lead_product_types
  for select
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = public.lead_product_types.org_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists lead_product_types_insert on public.lead_product_types
  for insert
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = public.lead_product_types.org_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists lead_product_types_update on public.lead_product_types
  for update
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = public.lead_product_types.org_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.memberships m
      where m.org_id = public.lead_product_types.org_id
        and m.user_id = auth.uid()
    )
  );

create policy if not exists lead_product_types_delete on public.lead_product_types
  for delete
  using (
    exists (
      select 1
      from public.memberships m
      where m.org_id = public.lead_product_types.org_id
        and m.user_id = auth.uid()
    )
  );

insert into public.lead_product_types (org_id, name)
select o.id, 'Isolation'
from public.organizations o
where not exists (
  select 1
  from public.lead_product_types lpt
  where lpt.org_id = o.id
    and lower(lpt.name) = lower('Isolation')
);

insert into public.lead_product_types (org_id, name)
select o.id, 'Led'
from public.organizations o
where not exists (
  select 1
  from public.lead_product_types lpt
  where lpt.org_id = o.id
    and lower(lpt.name) = lower('Led')
);
