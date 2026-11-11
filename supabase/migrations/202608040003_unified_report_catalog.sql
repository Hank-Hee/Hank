alter table app_private.related_information rename column source_name to publisher;

alter table app_private.related_information alter column summary drop not null;
alter table app_private.related_information alter column published_on drop not null;

alter table app_private.related_information
  add column source_family text not null default '行业研究',
  add column source_record_id text,
  add column synced_on date not null default current_date,
  add column attachment_object_key text,
  add column attachment_sha256 text,
  add column attachment_mime_type text,
  add column attachment_byte_size bigint;

update app_private.related_information
set source_record_id = id,
    information_type = '行业研究报告'
where kind = 'report';

alter table app_private.related_information
  alter column source_record_id set not null,
  add constraint related_information_source_family_check
    check (source_family in ('公司披露', '行业研究')),
  add constraint related_information_type_check
    check (information_type in (
      '年度综合报告', '财务报告', 'ESG与可持续发展报告', '行业研究报告'
    )),
  add constraint related_information_source_record_unique
    unique (source_family, source_record_id),
  add constraint related_information_attachment_metadata_check
    check (
      (not attachment_available
        and attachment_object_key is null
        and attachment_sha256 is null
        and attachment_mime_type is null
        and attachment_byte_size is null)
      or
      (attachment_available
        and attachment_object_key is not null
        and attachment_object_key <> ''
        and attachment_sha256 ~ '^[a-f0-9]{64}$'
        and attachment_mime_type is not null
        and attachment_byte_size > 0)
    );

create index related_information_catalog_filters_idx
  on app_private.related_information (kind, information_type, source_family, publisher);
create index related_information_published_on_idx
  on app_private.related_information (published_on desc nulls last)
  where kind = 'report';
create index related_information_keywords_idx
  on app_private.related_information using gin (keywords);
