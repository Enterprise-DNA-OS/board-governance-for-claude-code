-- Board secretary records. Trusted operators only; no public database roles.
create function touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create table boards (id uuid primary key default gen_random_uuid(), code text not null unique, name text not null, jurisdiction text not null check(jurisdiction in ('NZ','AU')), secretary text not null, quorum integer not null check(quorum>0), review_days integer not null default 365 check(review_days>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on boards for each row execute function touch_updated_at();
alter table boards enable row level security; revoke all on boards from public;
create table meetings (id uuid primary key default gen_random_uuid(), board_id uuid not null references boards, code text not null unique, name text not null, held_on date not null, chair text not null, location text not null default '', state text not null default 'planned' check(state in ('planned','held','cancelled')), retention_until date, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on meetings for each row execute function touch_updated_at();
alter table meetings enable row level security; revoke all on meetings from public;
create table agenda_items (id uuid primary key default gen_random_uuid(), meeting_id uuid not null references meetings, position integer not null check(position>0), name text not null, presenter text not null, purpose text not null check(purpose in ('note','discuss','decide')), paper_ref text not null default '', unique(meeting_id,position), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on agenda_items for each row execute function touch_updated_at();
alter table agenda_items enable row level security; revoke all on agenda_items from public;
create table attendance (id uuid primary key default gen_random_uuid(), meeting_id uuid not null references meetings, name text not null, role text not null check(role in ('director','guest')), present boolean not null, unique(meeting_id,name), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on attendance for each row execute function touch_updated_at();
alter table attendance enable row level security; revoke all on attendance from public;
create table minutes (id uuid primary key default gen_random_uuid(), meeting_id uuid not null references meetings, version integer not null check(version>0), body text not null check(length(trim(body))>0), recorded_on date not null default current_date, author text not null, signed_by text, signed_on date, signature_ref text, unique(meeting_id,version), check((signed_by is null and signed_on is null and signature_ref is null) or (length(trim(signed_by))>0 and signed_on is not null and length(trim(signature_ref))>0)), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on minutes for each row execute function touch_updated_at();
alter table minutes enable row level security; revoke all on minutes from public;
create table resolutions (id uuid primary key default gen_random_uuid(), meeting_id uuid not null references meetings, code text not null unique, name text not null, outcome text not null check(outcome in ('passed','rejected','deferred')), evidence text not null check(length(trim(evidence))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on resolutions for each row execute function touch_updated_at();
alter table resolutions enable row level security; revoke all on resolutions from public;
create table actions (id uuid primary key default gen_random_uuid(), board_id uuid not null references boards, meeting_id uuid references meetings, resolution_id uuid references resolutions, code text not null unique, name text not null, owner text not null default '', due_on date, status text not null default 'open' check(status in ('open','in-progress','done','cancelled')), completion_evidence text not null default '', source_key text unique, source_row jsonb, check(status not in ('done','cancelled') or length(trim(completion_evidence))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on actions for each row execute function touch_updated_at();
alter table actions enable row level security; revoke all on actions from public;
create table interests (id uuid primary key default gen_random_uuid(), board_id uuid not null references boards, code text not null unique, name text not null, director text not null, details text not null, declared_on date not null, disclosed_on date, review_on date not null, evidence text not null default '', check(disclosed_on is null or disclosed_on>=declared_on), check(disclosed_on is null or length(trim(evidence))>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on interests for each row execute function touch_updated_at();
alter table interests enable row level security; revoke all on interests from public;
create table events (id uuid primary key default gen_random_uuid(), entity_type text not null, entity_id uuid not null, actor text not null, action text not null, detail jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on events for each row execute function touch_updated_at();
alter table events enable row level security; revoke all on events from public;
create table imports (id uuid primary key default gen_random_uuid(), source text not null, file_name text not null, sha256 text not null, added integer not null, skipped integer not null, actor text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create trigger touch before update on imports for each row execute function touch_updated_at();
alter table imports enable row level security; revoke all on imports from public;
create unique index boards_code_lower on boards(lower(code));
create unique index meetings_code_lower on meetings(lower(code));
create unique index resolutions_code_lower on resolutions(lower(code));
create unique index actions_code_lower on actions(lower(code));
create unique index interests_code_lower on interests(lower(code));

create unique index attendance_name_lower on attendance(meeting_id,lower(name));
create function protect_signed_minutes() returns trigger language plpgsql as $$
begin
 if TG_OP='DELETE' or old.signed_on is not null then raise exception 'Minutes history is immutable; append a correction version'; end if;
 if (to_jsonb(new)-'signed_by'-'signed_on'-'signature_ref'-'updated_at') is distinct from (to_jsonb(old)-'signed_by'-'signed_on'-'signature_ref'-'updated_at') then raise exception 'Append a new minutes version'; end if;
 return new;
end $$;
create trigger immutable_minutes before update or delete on minutes for each row execute function protect_signed_minutes();
create function protect_history() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
create trigger immutable_events before update or delete on events for each row execute function protect_history();
create trigger immutable_resolutions before update or delete on resolutions for each row execute function protect_history();
create trigger immutable_imports before update or delete on imports for each row execute function protect_history();
create function action_board_consistency() returns trigger language plpgsql as $$
begin
 if new.meeting_id is not null and not exists(select 1 from meetings where id=new.meeting_id and board_id=new.board_id) then raise exception 'Action and meeting must share a board'; end if;
 if new.resolution_id is not null and not exists(select 1 from resolutions where id=new.resolution_id and meeting_id=new.meeting_id) then raise exception 'Resolution must belong to the action meeting'; end if;
 return new;
end $$;
create trigger action_scope before insert or update on actions for each row execute function action_board_consistency();
create view meeting_register as
select m.id,m.code,m.name,b.name as board,b.jurisdiction,m.held_on,m.chair,m.state,b.quorum,
(select count(*)::int from attendance a where a.meeting_id=m.id and a.role='director' and a.present) as present_directors,
(select count(*)::int from agenda_items a where a.meeting_id=m.id) as agenda_items,
(select count(*)::int from agenda_items a where a.meeting_id=m.id and a.purpose='decide' and trim(a.paper_ref)='') as missing_decision_papers,
(select max(version) from minutes n where n.meeting_id=m.id) as minute_version,
(select signed_on from minutes n where n.meeting_id=m.id order by version desc limit 1) as signed_on,
(select min(recorded_on) from minutes n where n.meeting_id=m.id) as first_recorded_on,
(m.held_on+interval '1 month')::date as au_record_due,m.retention_until
from meetings m join boards b on b.id=m.board_id;
create view action_register as
select a.id,a.code,a.name,b.name as board,m.code as meeting,r.code as resolution,a.owner,a.due_on,a.status,
case when a.status not in ('done','cancelled') and a.due_on<current_date then current_date-a.due_on else 0 end as days_overdue,
a.completion_evidence,a.source_key
from actions a join boards b on b.id=a.board_id left join meetings m on m.id=a.meeting_id left join resolutions r on r.id=a.resolution_id;
create view board_week as
select code,name,board,held_on,chair,agenda_items,missing_decision_papers from meeting_register
where state='planned' and held_on<=current_date+14 order by held_on,code;
create view attention as
select 'action-overdue' as issue,code,name,board,owner,due_on as due from action_register where days_overdue>0
union all select 'action-owner-missing',code,name,board,owner,due_on from action_register where trim(owner)='' and status not in ('done','cancelled')
union all select 'action-date-missing',code,name,board,owner,due_on from action_register where due_on is null and status not in ('done','cancelled')
union all select 'minutes-missing',code,name,board,chair,held_on from meeting_register where state='held' and minute_version is null
union all select 'minutes-unsigned',code,name,board,chair,held_on from meeting_register where state='held' and minute_version is not null and signed_on is null
union all select 'meeting-not-closed',code,name,board,chair,held_on from meeting_register where state='planned' and held_on<current_date
union all select 'interest-review',i.code,i.name,b.name,i.director,i.review_on from interests i join boards b on b.id=i.board_id where i.review_on<current_date;
create view compliance_findings as
select 'AU-251A-record' as rule,code,name,board,'No minutes recorded within one calendar month' as finding,'https://asic.gov.au/about-asic/contact-us/reporting-misconduct-to-asic/disputes-about-access-to-company-information/' as source
from meeting_register where jurisdiction='AU' and state='held' and ((first_recorded_on is null and current_date>au_record_due) or first_recorded_on>au_record_due)
union all select 'AU-251A-signature',code,name,board,'Latest minutes lack recorded chair signature evidence','https://asic.gov.au/about-asic/contact-us/reporting-misconduct-to-asic/disputes-about-access-to-company-information/' from meeting_register where jurisdiction='AU' and state='held' and minute_version is not null and signed_on is null
union all select 'NZ-189-retention',code,name,board,'Record retention date does not cover seven years','https://companies-register.companiesoffice.govt.nz/help-centre/complying-with-the-law/keeping-company-records/' from meeting_register where jurisdiction='NZ' and state='held' and (retention_until is null or retention_until<(held_on+interval '7 years')::date)
union all select 'NZ-189-minutes',code,name,board,'Held meeting has no recorded minutes','https://companies-register.companiesoffice.govt.nz/help-centre/complying-with-the-law/keeping-company-records/' from meeting_register where jurisdiction='NZ' and state='held' and minute_version is null
union all select 'LOCAL-quorum',code,name,board,'Recorded directors present below configured quorum','docs/compliance.md#local-controls' from meeting_register where state='held' and present_directors<quorum
union all select 'LOCAL-interest-review',i.code,i.name,b.name,'Interest disclosure or review needs attention','docs/compliance.md#local-controls' from interests i join boards b on b.id=i.board_id where i.disclosed_on is null or i.review_on<current_date;
