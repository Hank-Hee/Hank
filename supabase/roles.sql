do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    -- Native PostgreSQL 17 gives non-superuser creators ADMIN but not SET by default.
    perform set_config('createrole_self_grant', 'set', true);
    create role app_runtime noinherit;
  end if;

  if exists (select 1 from pg_roles where rolname = 'postgres') then
    execute 'grant app_runtime to postgres with admin true, set true, inherit false';
  end if;
end
$$;
