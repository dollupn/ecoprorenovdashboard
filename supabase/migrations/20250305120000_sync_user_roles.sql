-- Helper function to find auth user ids by email so the client can invite members
create or replace function public.lookup_user_id_by_email(email text)
returns uuid
language sql
security definer
set search_path = auth, public
as $$
  select id
  from auth.users
  where lower(auth.users.email) = lower(email)
  limit 1;
$$;

comment on function public.lookup_user_id_by_email(text)
  is 'Returns the auth user id for the provided email, used when inviting organization members.';

-- Backfill user_roles entries so they mirror existing memberships
insert into public.user_roles (user_id, org_id, role)
select
  m.user_id,
  m.org_id,
  case m.role
    when 'owner' then 'admin'
    when 'admin' then 'admin'
    when 'commercial' then 'commercial'
    else 'user'
  end as role
from public.memberships m
on conflict (user_id, org_id) do update
  set role = excluded.role;
