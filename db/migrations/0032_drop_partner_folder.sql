-- 기본 폴더에서 연인을 뺐다(가족·친구들·회사만). 사람마다 있던 연인 기본 폴더를 지운다.
-- 폴더를 지워도 사람은 그대로이고(들어 있던 연결 contact_group_members만 같이 지워진다), 다른 폴더에 든 연결은 남는다.
-- 이 폴더에만 들어 있던 사람은 '폴더 없는 사람'으로 사람들 목록에 보인다.
-- 이관은 앱 계정(app_user)이 아니라 소유 계정으로 돌아서 기본 폴더 삭제를 막는 contact_groups_guard에 걸리지 않는다.
delete from public.contact_groups where builtin = 'partner';
