begin;
select plan(27);

select has_table('app_private', 'companies', 'companies table exists');
select has_table('app_private', 'company_assets', 'company_assets table exists');
select has_table('app_private', 'related_information', 'related_information table exists');
select has_table('app_private', 'company_related_information', 'company relationships table exists');
select has_table('app_private', 'fid_projects', 'FID projects table exists');

select is((select count(*)::integer from app_private.companies), 126, 'all traced company profiles');
select results_eq(
  $$select slug from app_private.companies where is_featured order by slug$$,
  $$values ('adnoc'), ('bp'), ('chevron'), ('eni'), ('exxonmobil'), ('petronas'), ('shell'), ('totalenergies')$$,
  'exact company slugs'
);
select is((select count(*)::integer from app_private.company_assets), 234, 'profile, project, and complete portfolio assets');
select ok(
  not exists (
    select slug from app_private.companies company
    where not exists (
      select 1 from app_private.company_assets asset
      where asset.company_slug = company.slug and asset.kind = 'profile'
    )
  ),
  'every company has a traced profile source'
);
select ok(
  not exists (
    select 1 from app_private.company_assets
    where source_path = '' or sha256 !~ '^[a-f0-9]{64}$' or byte_size <= 0
  ),
  'all source assets have paths, hashes, and sizes'
);
select is((select count(*)::integer from app_private.related_information where kind = 'report'), 1111, 'all normalized report metadata rows');
select is((select count(*)::integer from app_private.company_related_information), 2368, 'traced company-report and company-news relationships');
select is((select count(distinct information_type)::integer from app_private.related_information where kind = 'report'), 4, 'report types use the four-value vocabulary');
select is((select count(distinct source_family)::integer from app_private.related_information where kind = 'report'), 2, 'source family distinguishes corporate disclosures and industry research');
select is((select count(*)::integer from app_private.related_information where published_on is null), 0, 'all approved publication dates are archived');
select is((select max(synced_on)::text from app_private.related_information where kind = 'report'), '2026-08-07', 'report sync date is traceable');
select is((select count(*)::integer from app_private.related_information where kind = 'news'), 2252, 'all merged news stories are archived');
select is((select count(distinct news_category)::integer from app_private.related_information where kind = 'news'), 6, 'news uses the fixed six-category vocabulary');
select is((select count(*)::integer from app_private.fid_projects), 4383, 'historical-company rows are deduplicated into visible FID projects');
select is((select count(*)::integer from app_private.fid_projects where company_slug is not null), 1424, 'FID projects are linked to traced companies when aliases match');
select ok(
  not exists (select 1 from app_private.related_information where attachment_available),
  'report metadata does not imply an attachment'
);
select ok(
  not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'app_private'
      and relation.relname = any (array[
        'companies', 'company_assets', 'related_information', 'company_related_information', 'fid_projects'
      ])
      and not (relation.relrowsecurity and relation.relforcerowsecurity)
  ),
  'all company tables enable and force RLS'
);

create temporary table company_runtime_observations (
  key text primary key,
  value integer not null
) on commit drop;
grant insert on company_runtime_observations to app_runtime;

set local role app_runtime;
insert into company_runtime_observations (key, value) values
  ('missing_companies', (select count(*)::integer from app_private.companies)),
  ('missing_assets', (select count(*)::integer from app_private.company_assets));
reset role;
select is((select value from company_runtime_observations where key = 'missing_companies'), 0, 'missing context cannot read companies');
select is((select value from company_runtime_observations where key = 'missing_assets'), 0, 'missing context cannot read assets');

insert into app_private.profiles (user_id, email, status) values
  ('00000000-0000-4000-8000-000000000020', 'company-reader@example.com', 'active');
insert into app_private.user_roles (user_id, role_code) values
  ('00000000-0000-4000-8000-000000000020', 'sales_bd');
set local role app_runtime;
set local app.user_id = '00000000-0000-4000-8000-000000000020';
insert into company_runtime_observations (key, value) values
  ('active_companies', (select count(*)::integer from app_private.companies)),
  ('active_information', (select count(*)::integer from app_private.related_information)),
  ('active_fid', (select count(*)::integer from app_private.fid_projects));
reset role;
select is((select value from company_runtime_observations where key = 'active_companies'), 126, 'active user can read companies');
select is((select value from company_runtime_observations where key = 'active_information'), 3363, 'active user can read reports and news');
select is((select value from company_runtime_observations where key = 'active_fid'), 4383, 'active user can read FID projects');

select * from finish();
rollback;
