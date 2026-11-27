# 기억해유 (Remember You, 예전 이름 리드미)

가까운 사람(배우자·애인·가족·친한 친구)의 취향, 못 먹는 음식, 사이즈, 생일을 **내 기록으로 적어 두고**, 모르는 건 **물어봐서** 채우는 앱. 내 것(내 리드미)도 적어 둔다.
"아빠한테 물어봤는데 답해줘"처럼 쓴다. 답은 물어본 사람의 기록에 들어가고, 그 뒤로는 물어본 사람이 고친다. 한국어·영어, iOS·Android·웹.

계획과 완료 기준은 [PLAN.md](./PLAN.md), 디자인 시안은 캔버스 v3 "하늘 그라데이션 + 선 캐릭터"(https://claude.ai/artifact/BPLLQSFsKmMPRxxBuzJUcE).

## 구조

```
readme/
├─ apps/web/        Next.js 16 앱 화면 전체 + 앱 없이 답하는 웹 화면(/r/[token]) + 내 기록 링크로 받는 화면(/s/[token]) + 크론·푸시·앱 링크 API
├─ apps/mobile/     Capacitor 8 iOS·Android 껍데기(배포된 웹을 띄운다)
├─ packages/core/   음력 변환·다음 생일·알림 시점, 항목 사전, 사이즈 환산, 한/영 문구, 초대 토큰(순수 TS)
├─ db/              PostgreSQL 마이그레이션(db/migrations)과 RLS 통합 테스트(db/tests)
└─ scripts/         migrate.mjs(마이그레이션), write-local-env.mjs, fetch-fonts.mjs(앱 글꼴 포어스토리·눈누 기초고딕 직접 호스팅), fetch-wordmark-font.mjs(로고 글자만 담은 작은 글꼴)
```

## 처음 실행

```bash
pnpm install
pnpm db:start        # 로컬 Postgres 17(도커 readme-pg, 127.0.0.1:55433, DB readme)
pnpm env:local       # apps/web/.env.local 생성(DB 주소 + 로그인 세션 키 + 암호화 키 + 크론 비밀값)
pnpm db:migrate      # db/migrations 적용(pnpm db:reset은 로컬만 지우고 처음부터)
pnpm dev             # http://localhost:3200
```

로그인은 Google·Apple(키를 넣은 것만 버튼이 보인다)과 **데모로 둘러보기**(익명 계정 + 샘플 사람 4명, 7일 뒤 자동 삭제)로 로그인한다. 데모는 **개발 서버에서만 열려 있고 운영에서는 닫혀 있다**(버튼도 안 보이고 서버도 거절, `lib/demo-core.ts`). 운영에서 잠깐 열어야 할 때(스토어 심사)는 환경 변수 `DEMO_ENABLED=1`. 이메일 로그인은 없다.
가입하면 곧바로 **첫 메모** 화면(`/onboarding`)이 열린다: 하단 메뉴 없이 메모지 한 장에 "누구 이야기부터 적어 볼까요?"(캐릭터 말풍선), 이름 칸 또는 바로 고르는 이름(엄마·아빠·아내·남편)으로 새 사람을 정하고 글이나 말로 적어 '저장'하면 온보딩이 끝나고 그 사람 화면(`?welcome=1`: "○○ 메모장이 생겼어요")으로 간다(가려던 곳 `?next`가 있으면 그곳으로). 오른쪽 위 '건너뛰기'로 첫 메모 없이 마칠 수도 있다(둘 다 `profiles.onboarded_at`을 남기고, 시간대는 그 기기 것). 얼굴·음식·생일 단계와 직접 해 보는 체험(`?tour=`)은 없앴고 옛 `/onboarding/avatar·food·birthday` 주소는 `/onboarding`으로 옮겨 준다. 이용 기록은 `onboarding_done`(source `memo_voice`·`memo_text`)·`onboarding_skip`과 화면 열기(`page_view /onboarding`)이고, 어드민 > 가입 퍼널의 '온보딩(첫 메모)'에서 본다. 메모 쓰기 화면에서도 `+`로 이름 칸을 열어 없는 사람을 새로 더할 수 있다(`saveMemo`의 `newNames`). 선물 추천·같이 고르기는 사람이 있어야 의미가 있어 온보딩에 넣지 않았다.
언어는 기기(시스템) 언어를 따르고, 공유 관리에서 시스템·한국어·English를 고를 수 있다.
선물 추천을 고르는 동안(AI·쿠팡을 부르느라 몇 초)은 빈 자리 대신 **꼬마 소녀 마법사가 구슬을 들여다보는 3D 장면**(three.js, `lib/gift-scene.ts`)이 보이고, 소녀는 말풍선으로 진행을 알리고(고르고 있어요 → 떠올리는 중 → 찾는 중 → 거의 다 됐어요, `picks.loading.1~4`) 제목도 고르는 동안엔 "…찾는 중이에요", 다 고르면 "…골라 봤어요"로 바뀐다. 다 고르면 구슬이 번쩍이고 소녀가 "얍!"(`picks.shout`) 한 뒤 번쩍임 속에서 고른 선물이 드러난다. 장면 틀은 `components/PicksStage.tsx`(Suspense 바깥에서 고른 선물이 DOM에 들어오는 걸 지켜보며 순서를 이끈다. 고른 선물은 `PicksContent`로 감싸고 고르는 중 표시는 `PicksPending`), 단계별 보임·숨김은 `globals.css`의 `.picks-stage`. three는 `0.158.0`으로 고정(밝기 값이 이 버전 기준)하고 장면이 필요할 때만 동적 import(약 130KB gzip)하며, 끝나면 WebGL을 바로 놓는다. 선물이 0.7초 안에 오거나 움직임 줄이기면 장면 없이 바로 보이고, 한 화면에 장면은 하나만(여러 사람 화면은 나머지가 그림 자리만 보인다).

## 테스트

```bash
pnpm test            # core·암호화 단위 테스트(29개): 음력·윤달·30일 대체·다음 생일·알림·사이즈·한영 문구 짝·조사·AES-GCM
pnpm test:db         # RLS 통합 테스트(17개): 로그인 표 못 읽음, 남의 리드미·기록 못 읽음, 물어본 항목만 내 기록에, 링크 재사용·조작 불가, 남과 이어 붙이기 불가 …
pnpm e2e             # Playwright: 가입·온보딩 → 물어보기·웹 답 → 받은 답 고치기 → 다시 물어보기·취소 → 로그인하고 답하기 → 영어 사이즈 → 직접 적기 → 삭제 → 데모 → 기기 언어
pnpm typecheck && pnpm lint && pnpm build
```

e2e는 로컬 Postgres와 개발 서버(3200)가 떠 있어야 한다. 로그인은 `?demo=empty`(개발 서버에서만 먹는 빈 데모 계정)로 한다. `SHOTS=<폴더> pnpm e2e`면 주요 화면을 찍어 둔다.
RLS 테스트는 `DATABASE_URL=<Supabase 풀러 주소> pnpm test:db`로 운영 DB에도 돌릴 수 있다(테스트 사용자는 끝나면 지운다).

## 앱(iOS·Android)

```bash
cd apps/mobile
CAP_SERVER_URL=http://localhost:3200 pnpm build:ios        # 시뮬레이터 빌드(서명 없이)
CAP_SERVER_URL=http://10.0.2.2:3200 pnpm build:android     # 디버그 APK (ANDROID_HOME, JAVA_HOME 필요)
pnpm open:ios / pnpm open:android                          # Xcode·Android Studio로 열어 기기 실행·서명
```

- 앱은 `CAP_SERVER_URL`의 웹을 띄운다. 운영 빌드 전에는 반드시 운영 도메인으로 `pnpm sync`.
- 앱에서만: Face ID·지문 앱 잠금, 기기 로컬 생일 알림(서버 푸시 없이도 온다), 링크로 앱 열기, 네이티브 공유.
- 앱 ID `kr.readme.app`(확정, Play에 한 번 올리면 못 바꾼다).
- 구글은 웹뷰 로그인을 막으므로, 앱에서는 시스템 브라우저(`/auth/app/start`)로 로그인하고 3분짜리 원타임 토큰을 `kr.readme.app://auth?ott=…`로 받아 웹뷰에 세션을 넘긴다(`lib/native-auth.ts`).
- 아이콘·스플래시·스토어 그래픽: `node apps/mobile/scripts/make-assets.mjs`, 스토어 스크린샷: `node apps/mobile/scripts/store-screens.mjs`. 출시 절차는 [apps/mobile/STORE.md](./apps/mobile/STORE.md).

## 보안 설계

- 공개 프로필·검색·공유가 없다. 남의 데이터를 읽는 길이 없어서 **RLS**는 "본인 줄만"이다: 내 리드미(`card_sections`), 내 사람들(`contacts`)과 그 기록(`contact_cards`)·메모. 서버는 요청마다 트랜잭션 안에서 `set local role app_user` + `app.user_id`로 바꿔 쿼리하므로(`lib/db.ts`), 서버 코드에 실수가 있어도 DB가 남의 것을 돌려주지 않는다(`db/tests/rls.test.ts`). 앱 역할은 로그인 표(user·session·account)를 못 읽는다.
- 물어보기(`invites`)는 내 주소록 사람에게만 만든다. 답은 시스템 함수(`submit_request_answer`)가 물어본 항목만 물어본 사람의 기록에 넣고 항목별로 받은 때(`answered`)를 남긴다. 값이 없는 항목은 저장하지 않고(사람이 '없어요'로 직접 비운 것만 예외), 적은 게 하나도 없으면 답으로 치지 않는다(`lib/ask-core.ts` `keepAnswered`). 내가 그 항목을 고치면 받은 때 표시가 빠진다. 로그인하고 답하면 주소록 칸이 그 사용자와 이어져(`person_id`, 앱 역할은 못 바꾼다) 얼굴·이름만 보인다.
- 알레르기·사이즈·기념일·메모·물어볼 때 미리 채운 값은 서버 키(AES-256-GCM)로 암호화하고, 어느 사람·어느 항목의 값인지 묶어서(AAD) 다른 행에 옮겨 붙이면 풀리지 않는다.
- 물어보기 토큰은 해시만 저장, 7일 만료, 한 번만 답할 수 있다. 사람을 지우면 그 사람에게 보낸 링크도 지워진다.
- 답한 내용은 물어본 사람의 기록이 된다(답하는 화면에 알린다). 알레르기 같은 건강 정보는 보내기 전에 동의를 받는다(개인정보보호법 제23조 민감정보). 로그인하고 답하면 고른 경우 내 리드미에도 저장한다.
- 계정 삭제는 앱 안에서 바로(앱스토어 심사 5.1.1(v)). 내 정보 내려받기(JSON) 제공.

## 운영

- 웹: Vercel 프로젝트 `remember-you`(2026-11-26 `readme`에서 이름 바꿈, madoriks-projects, 루트 `apps/web`, 함수 지역 icn1(서울)) → **https://remember-you.watalabs.com**(watalabs.com DNS가 같은 Vercel 팀에 있다. 예전 주소 itsreadme.vercel.app은 308로 넘어온다). 예전 운영 주소 readme.watalabs.com은 2026-11-26에 뗐다(주소를 바꾼 11-15 뒤로 나온 앱은 새 주소를 띄우고, 물어보기 링크는 7일이면 끝난다). 배포는 저장소 루트에서 `vercel deploy --prod`(`.vercelignore`가 비밀값·네이티브 폴더를 뺀다).
- DB: Supabase 프로젝트 `readme`(madorik's Org, Free, 서울 ap-northeast-2). Supabase의 Data API는 꺼 두었고(0006 마이그레이션으로 anon·authenticated 권한도 회수), 앱은 Postgres로만 붙는다. Vercel `DATABASE_URL` = 트랜잭션 풀러(`aws-0-ap-northeast-2.pooler.supabase.com:6543`, 사용자 `postgres.<ref>`), `DATABASE_URL_UNPOOLED` = 세션 풀러(같은 호스트 5432, 마이그레이션용). 비밀번호·ref는 `~/.readme/supabase.env`. 마이그레이션: `vercel env pull <파일> --environment production` 뒤 `node --env-file=<파일> scripts/migrate.mjs`. **0012 → 0013 사이에만** 공유받던 리드미를 기록으로 복사해야 한다: migrate가 0013에서 멈추면 `npx tsx --env-file=<파일> scripts/records-copy.mts`(암호화 키 필요) 뒤 migrate를 한 번 더. 무료 프로젝트는 1주일 동안 활동이 없으면 일시정지된다(매일 크론이 DB를 읽는다).
- 비밀값(`BETTER_AUTH_SECRET`, `DATA_ENCRYPTION_KEY`, `CRON_SECRET`)은 Vercel과 저장소 밖 `~/.readme/prod-secrets.env`에 있다. **암호화 키를 잃으면 저장된 알레르기·사이즈·메모를 못 읽는다.**
- `vercel.json`이 매일 오전 8시(KST)에 생일 알림 크론을 부르고, 그때 7일 지난 데모 계정을 지운다.
- 약관류(로그인 없이 열림, `?lang=en`): `/privacy-policy`, `/terms`, `/delete-account`.

## 비용·한도

고정비는 거의 없고(Vercel·Supabase 무료, 사진 저장소 없음, 음성 인식은 기기, 로그인은 직접 운영), 규모가 커질 때 튀는 곳은 아래 셋이다.

- **AI(OpenAI)**: 부르기 전에 `reserve_ai_call`(0022)로 자리를 잡는다(`lib/ai-quota.ts`). 지난 24시간 기준, 환경 변수로 바꾼다 — `AI_CAPTURE_DAILY_LIMIT`(말로 적기, 사람마다 기본 40), `AI_GIFT_DAILY_LIMIT`(선물 추천, 기본 60, 차면 AI 없이 기록만으로 고른다), `AI_IMPORT_DAILY_LIMIT`(메모 가져오기, 기본 5 — 한 번 가져오기가 한 번, 0030), `OPENAI_IMPORT_EFFORT`(가져오기 추론 강도, 기본 low), `OPENAI_IMPORT_IMAGE_MODEL`(메모 사진을 읽는 모델, 없으면 `OPENAI_MODEL`), `AI_DEMO_DAILY_LIMIT`(데모·익명 계정은 종류마다, 기본 5), `AI_GLOBAL_DAILY_LIMIT`(서비스 전체, 기본 3000). 0이면 그 기능을 막는다. 표·함수가 아직 없으면(배포와 마이그레이션 사이) 예전처럼 통과시키고, 그 밖의 오류는 막는다. **코드와 별개로 OpenAI 프로젝트에 월 사용 한도(Limits → Budget)를 꼭 건다.** 말로 적기의 추론 강도는 `OPENAI_CAPTURE_EFFORT`(기본 medium) — low로 내리면 싸지만 실제 문장으로 정확도를 견준 뒤에.
- **이용 기록(`app_events`)**: 화면에서 모아 보낸 것은 한 번에 넣는다(`unnest`). 매일 크론이 `APP_EVENTS_KEEP_DAYS`(기본 180, 90 밑으로는 못 내림)일보다 오래된 날을 (한국 날짜, 사람)마다 줄 하나로 접는다(`compact_app_events`, 0023): 그 날 활동한 사람 수(DAU·WAU·MAU·리텐션·방문자)와 머문 시간 합계는 그대로, 화면 보기 수와 화면별·경로별 숫자는 그 날부터 줄어든다. 최근 180일은 그대로라 /admin의 90일 범위와 8주 리텐션은 영향이 없다.
- **플랜 계단**: Vercel Hobby는 비상업용이라 쿠팡 파트너스 수익이 생기면 Pro(월 $20/seat 수준)로 올린다. 사용자 정보를 다루는 DB는 무료 플랜에 백업이 없으니 사용자가 늘면 Supabase Pro로 올린다(아래 백업은 그 전까지의 안전망). Vercel 웹 분석과 우리 통계(/admin)·GA4는 방문을 겹쳐 센다 — 요금이 문제 되면 하나를 끈다.

## 백업·복원

`.github/workflows/db-backup.yml`이 매일 03:17(KST) `scripts/backup-db.sh`로 운영 DB(public·app 스키마)를 덤프해 비밀번호(AES-256)로 암호화하고 S3 호환 저장소에 올린다. 이 저장소는 공개라서 Actions 아티팩트에는 두지 않는다. 이용 기록 내용·로그인 세션·캐시 표의 내용은 뺀다(표 모양은 들어 있다. 이용 기록도 넣으려면 `BACKUP_INCLUDE_EVENTS=1`).

**상태(2026-11-16 켬)**: R2 버킷 `readme-backups`(아시아·태평양, 비공개, `readme-db/` 30일 뒤 삭제 규칙), 그 버킷 전용 토큰(Object Read & Write), 시크릿 6개 설정 완료, Actions 수동 실행으로 올리기→내려받기→복호화→새 DB 복원까지 확인했다. 접근 키는 `~/.readme/r2.env`, 암호화 비밀번호는 `~/.readme/backup-passphrase.txt`에 있다. GitHub는 시크릿을 다시 보여 주지 않으니 이 두 파일과 `DATA_ENCRYPTION_KEY`는 비밀번호 관리자 같은 다른 곳에도 보관한다. 아래 1~2는 처음 설정할 때의 순서다.

1. 저장소 만들기(예: Cloudflare R2): 비공개 버킷 + 그 버킷만 읽기·쓰기 되는 API 토큰 + 객체 수명 규칙(30일 뒤 삭제).
2. 시크릿 6개(저장소 Settings → Secrets, 또는 `gh secret set <이름> --repo madorik/remember-you < 값 파일`): `DATABASE_URL_UNPOOLED`(세션 풀러 5432 주소), `BACKUP_PASSPHRASE`(`openssl rand -base64 32`로 만들고 **GitHub는 시크릿을 다시 보여 주지 않으니 `~/.readme/`에도 보관**), `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`(R2는 `https://<계정 ID>.r2.cloudflarestorage.com`), `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`. 비어 있으면 워크플로가 일부러 실패한다. Actions 탭에서 한 번 직접 실행해 확인한다.
3. 내 컴퓨터에서 바로 한 번 뜨기: `DATABASE_URL_UNPOOLED=… BACKUP_PASSPHRASE=… scripts/backup-db.sh` (pg_dump 17 이상 필요).
4. 복원(새 빈 DB에): `openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_PASSPHRASE -in <파일>.dump.enc > readme.dump` → `pg_restore --no-owner --dbname=<새 DB 주소> readme.dump`. `schema "public" already exists` 1개와 `role "supabase_admin" does not exist` 3개(Supabase 전용 역할 권한 줄)는 정상이다(2026-11-16 시험 복원에서 그 4개만 나왔다). `app_user` 역할이 없는 DB면 먼저 `node scripts/migrate.mjs`를 한 번 돌려 역할을 만든다.
5. **`DATA_ENCRYPTION_KEY`는 백업과 따로 보관한다.** 알레르기·사이즈·메모·기념일은 그 키로 암호화돼 있어서, 키가 없으면 복원해도 읽지 못한다.

## 남은 외부 설정

1. **구글 로그인**: Google Cloud 프로젝트 `readme-514623`(Google 인증 플랫폼, 앱 이름 리드미, 외부, 승인된 도메인 watalabs.com), 웹 클라이언트 `readme web`(리디렉션 `https://remember-you.watalabs.com/api/auth/callback/google`, `http://localhost:3200/api/auth/callback/google`). 값은 Vercel·`apps/web/.env.local`·`~/.readme/google-oauth.env`. **게시 상태가 '테스트 중'이면 테스트 사용자만 로그인된다** → 대상 > 앱 게시로 프로덕션.
2. **Apple 로그인**(iOS 출시 전): Services ID + Sign in with Apple 키로 client secret(JWT)을 만들어 `APPLE_CLIENT_ID`·`APPLE_CLIENT_SECRET`. Return URL `https://remember-you.watalabs.com/api/auth/callback/apple`.
3. **앱 링크**: Android는 업로드 키와 Play 앱 서명 키 SHA-256이 `ANDROID_SHA256_FINGERPRINTS`에 있다(`/.well-known/*`는 요청 때 환경 변수를 읽는다). iOS는 `apps/mobile/ios/App/App/App.entitlements`의 Associated Domains `applinks:remember-you.watalabs.com`(프로젝트에 이미 연결, 다음 빌드부터 적용·Apple 개발자 계정에서 Associated Domains 기능이 켜져 있어야 한다), 서버에 `APPLE_TEAM_ID`. 앱 링크는 물어보기(`/r/*`)와 내 기록 링크(`/s/*`) 둘이고, 네이티브 설정을 바꿨으니 앱을 새로 빌드해야 /s/ 링크가 앱에서 바로 열린다.
4. **카카오톡 공유(선택)**: JavaScript 키를 `NEXT_PUBLIC_KAKAO_JS_KEY`에, 플랫폼에 운영 도메인 등록.
5. **서버 푸시(선택)**: Firebase 프로젝트 → `google-services.json`·APNs 키, 서비스 계정 값을 `FCM_*`에. 없으면 앱은 기기 로컬 알림만 쓴다. **웹 브라우저 푸시(선택)**: `VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`(`apps/web/.env.example` 참고)를 넣으면 설정에 '이 브라우저에서 알림'이 생기고 크론(`/api/cron/reminders`)이 그 브라우저로 생일·기념일을 보낸다(앱은 기기 로컬 알림이라 크론이 보내지 않는다)(처리방침의 위탁 목록에 Google FCM을 더해야 한다).

## 아직 안 한 것

- 같은 기록을 두 기기에서 동시에 고치면 마지막 저장이 이긴다(저장할 때 `updated_at` 확인이 없다).
- 익명(데모) 로그인과 `/api/e`에 IP 단위 제한이 없다(데모 계정은 AI 하루 5회지만 계정을 많이 만들면 전체 한도를 쓸 수 있다). Vercel 방화벽·Turnstile로 막는다.
- 오프라인 읽기(매장에서 신호가 약할 때), 알림 시각 고르기(지금 기기 오전 9시 고정), N일 기념일(100일·1000일), 사람 삭제 휴지통(지금은 확인 시트 뒤 바로 삭제)은 없다.
- 공개 페이지(`/gifts`·`/terms` 등)는 루트 레이아웃이 세션을 읽어서 요청마다 서버에서 그린다(정적이 아님). 공개용 루트 레이아웃을 따로 두면 정적으로 된다.
- 암호화 키에 버전이 없다(`DATA_ENCRYPTION_KEY` 하나). 키를 바꾸려면 한 번에 다시 암호화하는 스크립트가 먼저 필요하다. 풀 수 없는 값은 덮어쓰지 않고 저장을 거부한다.
- 음력은 2050년까지만 변환된다(그 뒤 음력 일정은 안 나온다).

- "사진으로 입력"(옷 태그 사진으로 사이즈 읽기)·"말로 입력"은 없다(말로 입력은 2026-11-15에 뺐다).
- 답하기 요청에 IP 단위 횟수 제한이 없다(링크 토큰은 추측할 수 없지만). 정식 출시 전에 Vercel 방화벽이나 미들웨어로 막는다.
- 데모 계정으로 쓰다가 앱에서 구글로 로그인하면(시스템 브라우저 경로) 데모 계정은 남았다가 7일 뒤 크론이 지운다(웹에서는 바로 지워진다).
