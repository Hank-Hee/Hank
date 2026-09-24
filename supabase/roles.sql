do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime noinherit;
  end if;

  if exists (select 1 from pg_roles where rolname = 'postgres') then
    execute 'grant app_runtime to postgres';
  else
    -- Homebrew PostgreSQL has no built-in postgres role; authorize its local admin.
    execute format('grant app_runtime to %I', current_user);
  end if;
end
$$;
