create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime;
  end if;
end
$$;

alter role app_runtime
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;

do $$
declare
  granted_role text;
begin
  for granted_role in
    select parent.rolname
    from pg_auth_members membership
    join pg_roles member on member.oid = membership.member
    join pg_roles parent on parent.oid = membership.roleid
    where member.rolname = 'app_runtime'
  loop
    execute format('revoke %I from app_runtime', granted_role);
  end loop;
end
$$;

create table app_private.security_levels (
  code text primary key,
  rank smallint not null unique check (rank between 1 and 4)
);
create table app_private.rights_types (code text primary key);
create table app_private.roles (code text primary key, name_zh text not null);
create table app_private.permissions (code text primary key, description text not null);
create table app_private.role_permissions (
  role_code text not null references app_private.roles(code) on delete cascade,
  permission_code text not null references app_private.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);
create table app_private.profiles (
  user_id uuid primary key,
  email text not null check (char_length(email) between 3 and 254 and position('@' in email) > 1),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table app_private.user_roles (
  user_id uuid not null references app_private.profiles(user_id) on delete cascade,
  role_code text not null references app_private.roles(code) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create table app_private.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  request_id text not null check (request_id ~ '^req_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$'),
  action text not null,
  subject_type text not null,
  subject_id text,
  metadata jsonb not null default '{}'::jsonb
);

insert into app_private.security_levels (code, rank) values
  ('L1', 1), ('L2', 2), ('L3', 3), ('L4', 4);
insert into app_private.rights_types (code) values
  ('OWNED'), ('PUBLIC_THIRD_PARTY'), ('LICENSED_RESTRICTED'), ('DERIVED_REVIEW_REQUIRED');
insert into app_private.roles (code, name_zh) values
  ('sales_bd', '销售/商务'),
  ('research_admin', '市场研究管理员'),
  ('content_editor', '内容编辑'),
  ('content_reviewer', '内容审核员'),
  ('management_readonly', '管理层只读'),
  ('super_admin', '超级管理员');
insert into app_private.permissions (code, description) values
  ('platform.access', 'Enter the authenticated platform.'),
  ('admin.user.manage', 'Manage user accounts.'),
  ('admin.authorization.manage', 'Manage roles and explicit grants.'),
  ('admin.policy.manage', 'Manage approved platform policy.'),
  ('audit.read', 'Read Foundation audit records through a later controlled interface.');
insert into app_private.role_permissions (role_code, permission_code) values
  ('sales_bd', 'platform.access'),
  ('research_admin', 'platform.access'),
  ('research_admin', 'audit.read'),
  ('content_editor', 'platform.access'),
  ('content_reviewer', 'platform.access'),
  ('content_reviewer', 'audit.read'),
  ('management_readonly', 'platform.access'),
  ('management_readonly', 'audit.read'),
  ('super_admin', 'platform.access'),
  ('super_admin', 'admin.user.manage'),
  ('super_admin', 'admin.authorization.manage'),
  ('super_admin', 'admin.policy.manage'),
  ('super_admin', 'audit.read');

create or replace function app_private.current_user_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  raw_user_id text := current_setting('app.user_id', true);
begin
  if raw_user_id is null
     or raw_user_id = ''
     or raw_user_id !~ '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' then
    return null;
  end if;
  return raw_user_id::uuid;
end
$$;

create or replace function app_private.get_current_user_context()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, app_private
as $$
  select jsonb_build_object(
    'userId', p.user_id::text,
    'email', p.email,
    'roles', coalesce((
      select jsonb_agg(role_code order by role_code)
      from (select distinct ur.role_code from app_private.user_roles ur where ur.user_id = p.user_id) r
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(permission_code order by permission_code)
      from (
        select distinct rp.permission_code
        from app_private.user_roles ur
        join app_private.role_permissions rp on rp.role_code = ur.role_code
        where ur.user_id = p.user_id
      ) permissions_for_user
    ), '[]'::jsonb)
  )
  from app_private.profiles p
  where p.user_id = app_private.current_user_id()
    and p.status = 'active';
$$;

alter table app_private.profiles enable row level security;
alter table app_private.profiles force row level security;
alter table app_private.user_roles enable row level security;
alter table app_private.user_roles force row level security;
alter table app_private.roles enable row level security;
alter table app_private.roles force row level security;
alter table app_private.permissions enable row level security;
alter table app_private.permissions force row level security;
alter table app_private.role_permissions enable row level security;
alter table app_private.role_permissions force row level security;
alter table app_private.security_levels enable row level security;
alter table app_private.security_levels force row level security;
alter table app_private.rights_types enable row level security;
alter table app_private.rights_types force row level security;
alter table app_private.audit_events enable row level security;
alter table app_private.audit_events force row level security;

create policy profiles_self on app_private.profiles for select to app_runtime
  using (user_id = app_private.current_user_id() and status = 'active');
create policy user_roles_self on app_private.user_roles for select to app_runtime
  using (
    user_id = app_private.current_user_id()
    and exists (
      select 1 from app_private.profiles active_profile
      where active_profile.user_id = app_private.current_user_id()
        and active_profile.status = 'active'
    )
  );
create policy roles_authenticated_context on app_private.roles for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy permissions_authenticated_context on app_private.permissions for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy role_permissions_authenticated_context on app_private.role_permissions for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy security_levels_authenticated_context on app_private.security_levels for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy rights_types_authenticated_context on app_private.rights_types for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));

revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant usage on schema app_private to app_runtime;
grant select on app_private.profiles, app_private.user_roles, app_private.roles,
  app_private.permissions, app_private.role_permissions,
  app_private.security_levels, app_private.rights_types to app_runtime;
grant execute on function app_private.current_user_id() to app_runtime;
grant execute on function app_private.get_current_user_context() to app_runtime;
