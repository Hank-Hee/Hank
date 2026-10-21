create table app_private.companies (
  slug text primary key check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  source_id text not null unique check (source_id ~ '^[a-f0-9]{24}$'),
  display_name text not null,
  company_type text not null check (company_type in ('IOC', 'NOC')),
  country text not null,
  region text not null,
  business text not null,
  market_position text not null,
  website text not null check (website ~ '^https://'),
  founded_year smallint check (founded_year between 1800 and 2100),
  headquarters text not null,
  project_count integer not null check (project_count > 0),
  country_count integer not null check (country_count > 0),
  business_regions text[] not null check (cardinality(business_regions) > 0),
  is_featured boolean not null default true,
  updated_at timestamptz not null default now()
);

create table app_private.company_assets (
  company_slug text not null references app_private.companies(slug) on delete cascade,
  kind text not null check (kind in (
    'profile', 'banner', 'map-and-project-type', 'production-dashboard',
    'production-data', 'financial-dashboard', 'financial-data'
  )),
  source_path text not null check (source_path <> '' and source_path !~ '(^|/)\.\.(/|$)'),
  status text not null check (status in ('present', 'missing', 'invalid')),
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  primary key (company_slug, kind)
);

create table app_private.related_information (
  id text primary key check (id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  kind text not null check (kind in ('report', 'news')),
  title text not null,
  subtitle text,
  summary text not null,
  industry text not null,
  region text not null,
  information_type text not null,
  source_name text not null,
  published_on date not null,
  language text not null,
  source_format text not null,
  attachment_available boolean not null default false,
  keywords text[] not null default '{}'
);

create table app_private.company_related_information (
  company_slug text not null references app_private.companies(slug) on delete cascade,
  information_id text not null references app_private.related_information(id) on delete cascade,
  primary key (company_slug, information_id)
);

alter table app_private.companies enable row level security;
alter table app_private.companies force row level security;
alter table app_private.company_assets enable row level security;
alter table app_private.company_assets force row level security;
alter table app_private.related_information enable row level security;
alter table app_private.related_information force row level security;
alter table app_private.company_related_information enable row level security;
alter table app_private.company_related_information force row level security;

create policy companies_active_user_read on app_private.companies for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy company_assets_active_user_read on app_private.company_assets for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy related_information_active_user_read on app_private.related_information for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy company_related_information_active_user_read on app_private.company_related_information for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));

revoke all on app_private.companies, app_private.company_assets,
  app_private.related_information, app_private.company_related_information
  from public, anon, authenticated;
grant select on app_private.companies, app_private.company_assets,
  app_private.related_information, app_private.company_related_information
  to app_runtime;
