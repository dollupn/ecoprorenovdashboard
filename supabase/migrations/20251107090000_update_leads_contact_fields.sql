-- Update leads table to support new CRM form fields
alter table public.leads
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists building_length numeric,
  add column if not exists building_width numeric,
  add column if not exists building_height numeric,
  add column if not exists remarks text;

-- Populate new name columns from existing full_name when missing
update public.leads
set
  first_name = coalesce(first_name, nullif(trim(split_part(full_name, ' ', 1)), '')),
  last_name = coalesce(
    last_name,
    nullif(trim(
      case
        when position(' ' in full_name) > 0 then substr(full_name, position(' ' in full_name) + 1)
        else ''
      end
    ), '')
  )
where full_name is not null;

-- Clean existing SIREN values by removing spaces
update public.leads
set siren = regexp_replace(siren, '\\s+', '', 'g')
where siren is not null;

-- Ensure all existing rows have a placeholder SIREN before enforcing not null
update public.leads
set siren = '000000000'
where siren is null;

alter table public.leads
  alter column siren set not null;

alter table public.leads
  add constraint leads_siren_length_check
    check (char_length(regexp_replace(siren, '\\s+', '', 'g')) = 9);
