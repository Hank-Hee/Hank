alter table app_private.companies
  alter column updated_at set default now();

update app_private.companies set updated_at = '2026-08-07 00:00:00+00'::timestamptz;

alter table app_private.related_information
  add column summary_en text,
  add column source_url text,
  add column news_category text;

alter table app_private.related_information
  drop constraint if exists related_information_source_family_check,
  drop constraint if exists related_information_type_check;

alter table app_private.related_information
  add constraint related_information_source_family_check
    check (source_family in ('公司披露', '行业研究', '新闻资讯')),
  add constraint related_information_type_check
    check (
      (kind = 'report'
        and information_type in ('年度综合报告', '财务报告', 'ESG与可持续发展报告', '行业研究报告')
        and news_category is null)
      or
      (kind = 'news'
        and information_type = '新闻'
        and news_category in ('公司动态', '项目进展', '产量与运营', '财务与交易', '能源转型', '政策与市场'))
    ),
  add constraint related_information_source_url_check
    check (source_url is null or source_url ~ '^https://');

create table app_private.fid_projects (
  id text primary key check (id ~ '^[a-f0-9]{24}$'),
  operator_name text not null,
  company_slug text references app_private.companies(slug) on delete set null,
  project text not null,
  approval_year text,
  asset text not null,
  field_type text not null,
  facility_category text not null,
  interests text not null,
  country text not null,
  economics_usd_million numeric(20, 6),
  synced_on date not null,
  check (approval_year is null or approval_year ~ '^[0-9]{4}$'),
  check (economics_usd_million is null or economics_usd_million >= 0)
);

create index fid_projects_company_year_idx
  on app_private.fid_projects (company_slug, approval_year desc nulls last, project);

alter table app_private.fid_projects enable row level security;
alter table app_private.fid_projects force row level security;

create policy fid_projects_active_user_read on app_private.fid_projects for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));

revoke all on app_private.fid_projects from public, anon, authenticated;
grant select on app_private.fid_projects to app_runtime;
