begin;
select plan(2);
select hasnt_schema('app_private', 'Foundation schema is absent after baseline rollback');
select hasnt_role('app_runtime', 'Foundation runtime role is absent after baseline rollback');
select * from finish();
rollback;
