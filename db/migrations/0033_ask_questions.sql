-- 물어보기 개선: 한 질문만 묻기(오늘의 질문 id를 링크에 담는다) + 링크를 30일까지 열어 두기.
-- 코드는 이 마이그레이션이 적용되기 전에도 돈다: 새 열이 없으면 질문이 속한 항목 전체를 묻고, 기간 제약이 8일이면 7일짜리 링크로 만든다.

-- 1) 링크에 담긴 질문 id(오늘의 질문 id, 최대 3개). 비어 있으면 sections 전체를 묻는 예전 방식.
--    sections에는 그 질문들이 속한 항목이 함께 들어가 답이 그 항목 칸에 저장된다
alter table public.invites add column questions text[] check (questions is null or cardinality(questions) between 1 and 3);

-- 2) 링크 기간 제약을 8일에서 31일로(앱은 30일짜리를 만든다). 예전 제약은 이름이 환경마다 다를 수 있어 정의로 찾아 지운다
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.invites'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%expires_at <=%'
  loop
    execute format('alter table public.invites drop constraint %I', c);
  end loop;
end $$;
alter table public.invites add constraint invites_expires_check check (expires_at > created_at and expires_at <= created_at + interval '31 days');

-- 3) 답하는 웹 화면이 읽는 함수에 questions를 더한다(반환 열이 바뀌어 지우고 다시 만든다. 시스템 전용이라 권한은 그대로 막아 둔다)
drop function public.request_for_answer(text);
create function public.request_for_answer(p_token_hash text)
returns table (invite_id uuid, state text, inviter_id text, inviter_name text, contact_id uuid, recipient_name text, sections text[], prefill jsonb, message text, questions text[])
language plpgsql stable security definer set search_path = public as $$
declare
  i public.invites;
begin
  i := public.find_invite(p_token_hash, null);
  if i.id is null then
    return query select null::uuid, 'not_found'::text, null::text, null::text, null::uuid, null::text, null::text[], null::jsonb, null::text, null::text[];
    return;
  end if;
  return query select i.id, public.invite_state(i), i.inviter_id, (select display_name from public.profiles where id = i.inviter_id), i.contact_id,
    i.recipient_name, i.sections, i.prefill, i.message, i.questions;
end $$;
revoke all on function public.request_for_answer(text) from public;
