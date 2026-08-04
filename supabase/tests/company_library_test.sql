begin;
select plan(18);

select has_table('app_private', 'companies', 'companies table exists');
select has_table('app_private', 'company_assets', 'company_assets table exists');
select has_table('app_private', 'related_information', 'related_information table exists');
select has_table('app_private', 'company_related_information', 'company relationships table exists');

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
select is((select count(*)::integer from app_private.related_information where kind = 'report'), 24, 'all report metadata rows');
select is((select count(*)::integer from app_private.company_related_information), 27, 'traced company-report relationships');
select is((select count(*)::integer from app_private.related_information where kind = 'news'), 0, 'news is not fabricated');
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
        'companies', 'company_assets', 'related_information', 'company_related_information'
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
  ('active_reports', (select count(*)::integer from app_private.related_information));
reset role;
select is((select value from company_runtime_observations where key = 'active_companies'), 126, 'active user can read companies');
select is((select value from company_runtime_observations where key = 'active_reports'), 24, 'active user can read reports');

select * from finish();
rollback;
