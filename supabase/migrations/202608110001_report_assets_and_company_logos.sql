alter table app_private.related_information
  drop constraint if exists related_information_attachment_metadata_check,
  drop column if exists attachment_object_key,
  drop column if exists attachment_sha256,
  drop column if exists attachment_mime_type,
  drop column if exists attachment_byte_size;

create table app_private.report_assets (
  report_id text not null references app_private.related_information(id) on delete cascade,
  id text not null check (id ~ '^[a-f0-9]{24}$'),
  kind text not null check (kind in ('attachment', 'cover')),
  original_file_name text not null check (
    original_file_name <> '' and original_file_name !~ '[/\\]'
  ),
  object_key text not null check (
    object_key ~ '^report-assets/(published|source)/(attachments|covers)/[a-f0-9]{64}\.[a-z0-9]+$'
    and object_key !~ '(^|/)\.\.(/|$)'
  ),
  source_object_key text check (
    source_object_key is null
    or (
      source_object_key ~ '^report-assets/source/covers/[a-f0-9]{64}\.png$'
      and source_object_key !~ '(^|/)\.\.(/|$)'
    )
  ),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  source_sha256 text check (source_sha256 is null or source_sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 262144000),
  rights_type text not null references app_private.rights_types(code),
  security_level text not null references app_private.security_levels(code),
  review_status text not null check (review_status = 'approved'),
  uploaded_at timestamptz not null default now(),
  primary key (report_id, id),
  unique (report_id, kind, sha256)
);

create unique index report_assets_one_cover_per_report_idx
  on app_private.report_assets (report_id) where kind = 'cover';
create index report_assets_report_kind_idx
  on app_private.report_assets (report_id, kind);

create table app_private.company_brand_assets (
  company_slug text primary key references app_private.companies(slug) on delete cascade,
  object_key text not null unique check (
    object_key ~ '^company-assets/published/logos/[a-z0-9-]+/[a-f0-9]{64}\.png$'
    and object_key !~ '(^|/)\.\.(/|$)'
  ),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  mime_type text not null check (mime_type = 'image/png'),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 5242880),
  uploaded_at timestamptz not null default now()
);

create or replace function app_private.refresh_report_attachment_available()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  affected_report_id text;
begin
  affected_report_id := case when tg_op = 'DELETE' then old.report_id else new.report_id end;
  update app_private.related_information information
  set attachment_available = exists (
    select 1 from app_private.report_assets asset
    where asset.report_id = affected_report_id and asset.kind = 'attachment'
  )
  where information.id = affected_report_id and information.kind = 'report';
  return case when tg_op = 'DELETE' then old else new end;
end
$$;

create trigger report_assets_refresh_attachment_available
after insert or update or delete on app_private.report_assets
for each row execute function app_private.refresh_report_attachment_available();

alter table app_private.report_assets enable row level security;
alter table app_private.report_assets force row level security;
alter table app_private.company_brand_assets enable row level security;
alter table app_private.company_brand_assets force row level security;

create policy report_assets_active_user_read on app_private.report_assets for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy company_brand_assets_active_user_read on app_private.company_brand_assets for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));

revoke all on app_private.report_assets, app_private.company_brand_assets
  from public, anon, authenticated;
grant select on app_private.report_assets, app_private.company_brand_assets to app_runtime;
