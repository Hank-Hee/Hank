begin;
select plan(33);

select has_table('app_private', 'profiles', 'profiles table exists');
select has_table('app_private', 'roles', 'roles table exists');
select has_table('app_private', 'permissions', 'permissions table exists');
select has_table('app_private', 'role_permissions', 'role_permissions table exists');
select has_table('app_private', 'user_roles', 'user_roles table exists');
select has_table('app_private', 'security_levels', 'security_levels table exists');
select has_table('app_private', 'rights_types', 'rights_types table exists');
select has_table('app_private', 'audit_events', 'audit_events table exists');
select has_function('app_private', 'current_user_id', array[]::text[]);
select has_function('app_private', 'get_current_user_context', array[]::text[]);

select is((select count(*)::integer from app_private.roles), 6, 'six roles');
select is((select count(*)::integer from app_private.permissions), 5, 'five permissions');
select is((select count(*)::integer from app_private.security_levels), 4, 'four levels');
select is((select count(*)::integer from app_private.rights_types), 4, 'four rights types');

select results_eq(
  $$select code from app_private.roles order by code$$,
  $$values ('content_editor'), ('content_reviewer'), ('management_readonly'), ('research_admin'), ('sales_bd'), ('super_admin')$$,
  'exact role vocabulary'
);
select results_eq(
  $$select code from app_private.permissions order by code$$,
  $$values ('admin.authorization.manage'), ('admin.policy.manage'), ('admin.user.manage'), ('audit.read'), ('platform.access')$$,
  'exact Foundation permission vocabulary'
);
select results_eq(
  $$select code from app_private.security_levels order by rank$$,
  $$values ('L1'), ('L2'), ('L3'), ('L4')$$,
  'exact security levels'
);
select results_eq(
  $$select code from app_private.rights_types order by code$$,
  $$values ('DERIVED_REVIEW_REQUIRED'), ('LICENSED_RESTRICTED'), ('OWNED'), ('PUBLIC_THIRD_PARTY')$$,
  'exact rights types'
);
select results_eq(
  $$select role_code || ':' || permission_code from app_private.role_permissions order by role_code, permission_code$$,
  $$values
    ('content_editor:platform.access'),
    ('content_reviewer:audit.read'),
    ('content_reviewer:platform.access'),
    ('management_readonly:audit.read'),
    ('management_readonly:platform.access'),
    ('research_admin:audit.read'),
    ('research_admin:platform.access'),
    ('sales_bd:platform.access'),
    ('super_admin:admin.authorization.manage'),
    ('super_admin:admin.policy.manage'),
    ('super_admin:admin.user.manage'),
    ('super_admin:audit.read'),
    ('super_admin:platform.access')$$,
  'explicit role mapping without wildcard or cross join'
);

select ok(
  (select
    not runtime.rolcanlogin
    and not runtime.rolsuper
    and not runtime.rolcreatedb
    and not runtime.rolcreaterole
    and not runtime.rolinherit
    and not runtime.rolreplication
    and not runtime.rolbypassrls
    and not exists (select 1 from pg_auth_members membership where membership.member = runtime.oid)
    and not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'app_private'
        and relation.relkind = 'r'
        and relation.relowner = runtime.oid
    )
    from pg_roles runtime
    where runtime.rolname = 'app_runtime'),
  'runtime is nologin, noinherit, non-owner, non-member, and has no elevated attributes'
);
select ok(
  has_schema_privilege('app_runtime', 'app_private', 'USAGE')
  and not has_schema_privilege('app_runtime', 'app_private', 'CREATE')
  and (
    select array_agg(table_name::text order by table_name)
    from information_schema.role_table_grants
    where grantee = 'app_runtime'
      and table_schema = 'app_private'
      and privilege_type = 'SELECT'
  ) = array[
    'permissions', 'profiles', 'rights_types', 'role_permissions',
    'roles', 'security_levels', 'user_roles'
  ]::text[]
  and not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'app_runtime'
      and table_schema = 'app_private'
      and privilege_type <> 'SELECT'
  )
  and has_function_privilege('app_runtime', 'app_private.current_user_id()', 'EXECUTE')
  and has_function_privilege('app_runtime', 'app_private.get_current_user_context()', 'EXECUTE')
  and not exists (
    select 1 from information_schema.table_privileges
    where grantee in ('PUBLIC', 'anon', 'authenticated') and table_schema = 'app_private'
  )
  and not exists (
    select 1 from information_schema.routine_privileges
    where grantee in ('PUBLIC', 'anon', 'authenticated') and routine_schema = 'app_private'
  ),
  'runtime has only the exact Foundation read/execute grants and browser roles have none'
);
select ok(
  not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'app_private'
      and relation.relname = any (array[
        'profiles', 'roles', 'permissions', 'role_permissions',
        'user_roles', 'security_levels', 'rights_types', 'audit_events'
      ])
      and not (relation.relrowsecurity and relation.relforcerowsecurity)
  ),
  'all eight private tables enable and force RLS'
);

select is(app_private.current_user_id(), null::uuid, 'missing context fails closed');
set local app.user_id = '';
select is(app_private.current_user_id(), null::uuid, 'empty context fails closed');
set local app.user_id = 'not-a-uuid';
select is(app_private.current_user_id(), null::uuid, 'malformed context fails closed');
set local app.user_id = '019535d9-3df7-7a61-b20a-84d2a4e79057';
select is(
  app_private.current_user_id(),
  '019535d9-3df7-7a61-b20a-84d2a4e79057'::uuid,
  'UUIDv7 context matches the Task 2 UUID contract'
);

insert into app_private.profiles (user_id, email, status) values
  ('00000000-0000-4000-8000-000000000001', 'a@example.com', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'b@example.com', 'active'),
  ('00000000-0000-4000-8000-000000000003', 'disabled@example.com', 'inactive'),
  ('00000000-0000-4000-8000-000000000004', 'admin@example.com', 'active');
insert into app_private.user_roles (user_id, role_code) values
  ('00000000-0000-4000-8000-000000000001', 'sales_bd'),
  ('00000000-0000-4000-8000-000000000003', 'sales_bd'),
  ('00000000-0000-4000-8000-000000000004', 'super_admin');

create temporary table runtime_observations (
  key text primary key,
  value jsonb
) on commit drop;
grant insert on runtime_observations to app_runtime;

set local role app_runtime;
set local app.user_id = '00000000-0000-4000-8000-000000000001';
insert into runtime_observations (key, value) values
  ('user_a_profile_count', to_jsonb((select count(*)::integer from app_private.profiles))),
  ('user_a_context', app_private.get_current_user_context());
set local app.user_id = '00000000-0000-4000-8000-000000000003';
insert into runtime_observations (key, value) values
  ('inactive_context', app_private.get_current_user_context()),
  ('inactive_role_count', to_jsonb((select count(*)::integer from app_private.roles)));
set local app.user_id = '00000000-0000-4000-8000-000000000099';
insert into runtime_observations (key, value) values
  ('unknown_role_count', to_jsonb((select count(*)::integer from app_private.roles)));
reset role;

select is((select value from runtime_observations where key = 'user_a_profile_count'), '1'::jsonb, 'user A cannot read user B');
select is(
  (select value from runtime_observations where key = 'user_a_context'),
  '{"email":"a@example.com","permissions":["platform.access"],"roles":["sales_bd"],"userId":"00000000-0000-4000-8000-000000000001"}'::jsonb,
  'context is stable, unique, and matches Task 2 shape'
);
select is((select value from runtime_observations where key = 'inactive_context'), null::jsonb, 'inactive profile returns no context');
select is((select value from runtime_observations where key = 'inactive_role_count'), '0'::jsonb, 'inactive user cannot read lookup rows');
select is((select value from runtime_observations where key = 'unknown_role_count'), '0'::jsonb, 'unknown user cannot read lookup rows');

insert into app_private.permissions (code, description) values ('future.domain.read', 'synthetic future permission');
set local role app_runtime;
set local app.user_id = '00000000-0000-4000-8000-000000000004';
insert into runtime_observations (key, value) values
  ('future_permission_present', to_jsonb(app_private.get_current_user_context()->'permissions' ? 'future.domain.read'));
reset role;
select is((select value from runtime_observations where key = 'future_permission_present'), 'false'::jsonb, 'future permission is not inferred for super_admin');

delete from app_private.role_permissions where role_code = 'super_admin';
set local role app_runtime;
set local app.user_id = '00000000-0000-4000-8000-000000000004';
insert into runtime_observations (key, value) values
  ('super_admin_permissions', app_private.get_current_user_context()->'permissions');
reset role;
select is(
  (select value from runtime_observations where key = 'super_admin_permissions'),
  '[]'::jsonb,
  'super_admin with no grants has no inferred permissions'
);

select * from finish();
rollback;
