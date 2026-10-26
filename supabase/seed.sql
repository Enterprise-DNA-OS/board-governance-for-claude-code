-- Fictional demonstration records. Relative dates keep attention reports useful.
insert into boards(id,code,name,jurisdiction,secretary,quorum) values
('10000000-0000-4000-8000-000000000001','KOWHAI','Kowhai Components board','NZ','Mara Bell',3),
('10000000-0000-4000-8000-000000000002','BANKSIA','Banksia Services board','AU','Theo Price',2) on conflict do nothing;
insert into meetings(id,board_id,code,name,held_on,chair,state,retention_until) values
('10000000-0000-4000-8000-000000000010','10000000-0000-4000-8000-000000000001','NZ-NEXT','Quarterly strategy meeting',current_date+7,'Aroha Lane','planned',(current_date+7+interval '7 years')::date),
('10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000001','NZ-LAST','Operations review',current_date-40,'Aroha Lane','held',(current_date-40+interval '7 years')::date),
('10000000-0000-4000-8000-000000000012','10000000-0000-4000-8000-000000000002','AU-LAST','Audit committee review',current_date-60,'Mina Reed','held',null),
('10000000-0000-4000-8000-000000000013','10000000-0000-4000-8000-000000000002','AU-NEXT','Risk review',current_date+10,'Mina Reed','planned',null),
('10000000-0000-4000-8000-000000000014','10000000-0000-4000-8000-000000000001','NZ-OLD','Annual policy review',current_date-90,'Aroha Lane','held',null) on conflict do nothing;
insert into agenda_items(id,meeting_id,position,name,presenter,purpose,paper_ref) values
('10000000-0000-4000-8000-000000000020','10000000-0000-4000-8000-000000000010',1,'Capital allocation review','Iris Tan','decide',''),
('10000000-0000-4000-8000-000000000021','10000000-0000-4000-8000-000000000010',2,'Supplier dependency briefing','Theo Price','discuss','Internal paper KP-02'),
('10000000-0000-4000-8000-000000000022','10000000-0000-4000-8000-000000000013',1,'Risk appetite review','Mina Reed','decide','Paper BR-05') on conflict do nothing;
insert into attendance(id,meeting_id,name,role,present) select '10000000-0000-4000-8000-000000000030','10000000-0000-4000-8000-000000000011','Aroha Lane','director',true where not exists(select 1 from attendance where id='10000000-0000-4000-8000-000000000030') on conflict do nothing;
insert into attendance(id,meeting_id,name,role,present) select '10000000-0000-4000-8000-000000000031','10000000-0000-4000-8000-000000000011','Iris Tan','director',true where not exists(select 1 from attendance where id='10000000-0000-4000-8000-000000000031') on conflict do nothing;
insert into attendance(id,meeting_id,name,role,present) select '10000000-0000-4000-8000-000000000032','10000000-0000-4000-8000-000000000011','Mara Bell','director',true where not exists(select 1 from attendance where id='10000000-0000-4000-8000-000000000032') on conflict do nothing;
insert into attendance(id,meeting_id,name,role,present) select '10000000-0000-4000-8000-000000000034','10000000-0000-4000-8000-000000000012','Mina Reed','director',true where not exists(select 1 from attendance where id='10000000-0000-4000-8000-000000000034') on conflict do nothing;
insert into minutes(id,meeting_id,version,body,recorded_on,author,signed_by,signed_on,signature_ref) values
('10000000-0000-4000-8000-000000000040','10000000-0000-4000-8000-000000000011',1,'The board discussed supplier dependency and requested a revised continuity paper. Directors recorded the decision to review alternatives before renewal.',current_date-38,'Mara Bell','Aroha Lane',current_date-35,'Demo signed record NZ-LAST-01'),
('10000000-0000-4000-8000-000000000041','10000000-0000-4000-8000-000000000012',1,'Draft: the committee reviewed assurance gaps and asked for updated evidence before the next meeting.',current_date-10,'Theo Price',null,null,null) on conflict do nothing;
insert into resolutions(id,meeting_id,code,name,outcome,evidence) values
('10000000-0000-4000-8000-000000000050','10000000-0000-4000-8000-000000000011','RES-01','Review supplier alternatives','passed','Approved minute NZ-LAST v1, item 3') on conflict do nothing;
insert into actions(id,board_id,meeting_id,resolution_id,code,name,owner,due_on,status,completion_evidence) values
('10000000-0000-4000-8000-000000000060','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011','10000000-0000-4000-8000-000000000050','ACT-01','Prepare supplier alternatives','Theo Price',current_date-8,'open',''),
('10000000-0000-4000-8000-000000000061','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011',null,'ACT-02','Confirm insurance renewal evidence','',current_date+4,'open',''),
('10000000-0000-4000-8000-000000000062','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012',null,'ACT-03','Reconcile audit actions','Mina Reed',current_date-15,'in-progress',''),
('10000000-0000-4000-8000-000000000063','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012',null,'ACT-04','Prepare continuity exercise date','Theo Price',null,'open',''),
('10000000-0000-4000-8000-000000000064','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011',null,'ACT-05','Archive signed operations minutes','Mara Bell',current_date-20,'done','Demo archive receipt AR-01') on conflict do nothing;
insert into interests(id,board_id,code,name,director,details,declared_on,disclosed_on,review_on,evidence) values
('10000000-0000-4000-8000-000000000070','10000000-0000-4000-8000-000000000001','INT-01','Supplier advisory role','Iris Tan','Advises a supplier under consideration',current_date-400,null,current_date-35,''),
('10000000-0000-4000-8000-000000000071','10000000-0000-4000-8000-000000000002','INT-02','External directorship','Mina Reed','Director of a fictional service supplier',current_date-30,current_date-28,current_date+335,'Board note BI-02') on conflict do nothing;
