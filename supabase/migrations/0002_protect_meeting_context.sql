-- Preserve the meeting facts attached to signed minute records, including when
-- a later unsigned correction has been added.
create function protect_attendance() returns trigger language plpgsql as $$
begin
 if exists(select 1 from minutes where (meeting_id=new.meeting_id or meeting_id=old.meeting_id) and signed_on is not null) then raise exception 'Signed attendance history cannot be changed'; end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger signed_attendance before insert or update or delete on attendance for each row execute function protect_attendance();
create function protect_meeting_context() returns trigger language plpgsql as $$
begin
 if exists(select 1 from minutes where meeting_id=old.id and signed_on is not null) then raise exception 'Signed meeting context cannot be changed'; end if;
 if TG_OP='DELETE' then return old; end if; return new;
end $$;
create trigger signed_meeting before update or delete on meetings for each row execute function protect_meeting_context();
