alter table "public"."projects"
  add column if not exists "archived_at" timestamptz;
