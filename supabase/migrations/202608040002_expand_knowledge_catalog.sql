alter table app_private.companies drop constraint if exists companies_company_type_check;
alter table app_private.companies add constraint companies_company_type_check
  check (company_type in ('EPC', 'IOC', 'NOC', '联合体/合资公司', '船东', '资源型'));

alter table app_private.companies drop constraint if exists companies_project_count_check;
alter table app_private.companies add constraint companies_project_count_check check (project_count >= 0);

alter table app_private.companies drop constraint if exists companies_country_count_check;
alter table app_private.companies add constraint companies_country_count_check check (country_count >= 0);
