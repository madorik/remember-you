# 리드미 스토어 출시(Google Play 비공개 테스트부터)

> 2026-11-14 작성. 맹고와 같은 Play 개발자 계정. 콘솔에 그대로 붙여 넣을 값과 순서. 그래픽은 `apps/mobile/store/`, 서명 키는 저장소 밖 `~/.readme/`.
>
> **상태(2026-11-14)**: 앱 만들기·등록정보·앱 콘텐츠·스토어 설정을 마치고 비공개 테스트(Alpha) 0.1.0을 검토에 보냈고 같은 날 게시됨. 콘솔 작업은 전용 크롬(`~/.maengo/chrome-youtube`, 와타랩스 Play 계정 로그인)을 CDP로 붙여서 했다. 테스터: 그룹 https://groups.google.com/g/readme-testers 가입 → https://play.google.com/apps/testing/kr.readme.app 참여

## 기본 정보

| 항목 | 값 |
| --- | --- |
| 패키지 | `kr.readme.app` (바꿀 수 없음) |
| 앱 이름 | 리드미 - 소울메이트 컨닝페이퍼 / README - Soulmate Cheat Sheet |
| 기본 언어 | 한국어(ko-KR), 번역 영어(en-US) |
| 카테고리 | 앱 > 라이프스타일 |
| 연락처 이메일 | watalabs.help@gmail.com |
| 웹사이트 | https://remember-you.watalabs.com |
| 개인정보 처리방침 | https://remember-you.watalabs.com/privacy-policy (영어 `?lang=en`) |
| 이용약관 | https://remember-you.watalabs.com/terms |
| 계정 삭제 안내 | https://remember-you.watalabs.com/delete-account |
| 업로드 키 | `~/.readme/readme-upload.jks`, 비밀번호 `~/.readme/upload-keystore.properties`. SHA-256 `1F:27:29:AB:CB:5C:63:01:53:89:BF:EA:2F:2F:AB:76:B4:11:5B:59:FB:83:CB:64:47:45:34:82:98:28:90:1D` |
| Play 앱 서명 키 | SHA-256 `66:D5:33:9E:B5:9D:9A:66:F2:F2:55:8C:83:C5:F0:19:A6:94:41:4F:BE:80:A3:2E:AC:AC:92:FB:50:30:EC:2D`(Google 관리, API `generatedApks`로 확인). 두 값 모두 Vercel `ANDROID_SHA256_FINGERPRINTS`에 있음 |
| Play 앱 ID | 4975276465281685348 |

## 1. 콘솔에서 할 일(사람만 할 수 있음)

1. **앱 만들기**: Play Console > 모든 앱 > 앱 만들기. 앱 이름 `리드미 - 소울메이트 컨닝페이퍼`, 기본 언어 한국어, 앱, 무료, 선언 두 개 체크.
2. **서비스 계정 권한**: 사용자 및 권한 > `maengo-play-47@maengo-adfc4.iam.gserviceaccount.com` > 앱 권한에 리드미를 더했다(앱 초안 수정, 프로덕션·테스트 트랙 출시, 테스트 트랙·테스터 관리, 앱 정보 관리, 정책 선언 관리). 관리자·재무 권한은 주지 않음.
3. 여기까지 되면 아래 2번(등록정보·빌드 올리기)은 스크립트로 한다.

## 2. 스크립트로 올리기

```bash
# 등록정보(이름·설명·연락처) + 아이콘·그래픽 이미지·휴대폰 스크린샷(한/영)
node apps/mobile/scripts/store/listing.mjs

# 운영 주소로 앱을 묶어서 서명된 AAB 만들기(versionCode는 android/app/build.gradle에서 올릴 때마다 +1)
cp ~/.readme/google-services.json apps/mobile/android/app/google-services.json   # 푸시(FCM). 없으면 푸시 없이 빌드된다
cd apps/mobile && CAP_SERVER_URL=https://remember-you.watalabs.com npx cap sync android && cd android && ./gradlew bundleRelease
cd ../../.. && node apps/mobile/scripts/store/release.mjs apps/mobile/android/app/build/outputs/bundle/release/app-release.aab alpha "첫 비공개 테스트"
```

네 번째 인자로 영어 출시 노트를 줄 수 있다(`release.mjs <aab> alpha "한국어 노트" "English notes"`). 2026-11-15 비공개 테스트에 0.2.0(versionCode 3) 올림(말로 적기 기기 음성 인식). R8이 Capacitor 플러그인 어노테이션을 지우면 권한 요청에서 앱이 죽으므로 `proguard-rules.pro`의 keep 규칙을 지운다면 안 된다. 앱이 아직 한 번도 검토를 안 거쳤으면 Play가 초안 출시만 받는다. 스크립트가 알아서 초안으로 만들고, 콘솔에서 '검토를 위해 전송'을 누른다.

### 푸시(Firebase)

2026-11-17 Firebase 프로젝트 `remember-you`(ID `remember-you-b58b1`, 맹고와 따로, 애널리틱스·Gemini 끔)를 만들고 Android·iOS 앱 `kr.readme.app`을 등록했다.
설정 파일 `google-services.json`·`GoogleService-Info.plist`와 서버 발송 키 `firebase-admin.json`은 저장소 밖 `~/.readme/`에 있고(저장소에는 넣지 않는다, .gitignore),
Vercel 운영에 `FCM_PROJECT_ID`·`FCM_CLIENT_EMAIL`·`FCM_PRIVATE_KEY`(줄바꿈은 `\n`)를 넣었다.
첫 푸시 빌드는 0.3.0(versionCode 8). 웹은 versionCode 8 미만 앱에서는 푸시를 등록하지 않는다(설정 없이 빌드한 앱은 등록하면 멈춘다, `PUSH_MIN_ANDROID_BUILD`).
서버 푸시는 답장처럼 기기가 모르는 것만 보낸다(생일 알림은 기기 로컬 알림). 알림 허락은 앱을 켜자마자 묻지 않고, 답장을 기다릴 만한 때(`askReplyAlerts()`, apps/web/components/native.tsx)에 묻는다. 이미 허락한 기기만 앱을 열 때 토큰을 다시 등록한다.

#### iOS 푸시(코드는 준비됨, 아래 손일을 해야 켜진다)
iOS 앱은 Firebase 없이 Capacitor 푸시 플러그인이 주는 **APNs 기기 토큰**을 쓰고, 서버(`apps/web/lib/push.ts`의 `sendApns`)가 애플에 직접 보낸다(토큰이 16진수 64자 이상이면 APNs, 콜론이 든 FCM 토큰이면 FCM으로 가린다).
1. Apple Developer → Keys → **APNs 인증 키(.p8)** 를 하나 만든다(Apple Push Notifications service). 키 ID·팀 ID를 적어 두고 .p8은 `~/.readme/`에만 둔다(저장소에 넣지 않는다).
2. Xcode → App 타깃 → Signing & Capabilities → **+ Capability → Push Notifications**. App.entitlements에 `aps-environment`가 생기고 App ID·프로비저닝 프로필이 갱신된다(자동 서명이면 알아서).
3. `apps/web/components/native.tsx`의 `PUSH_MIN_IOS_BUILD`를 이 푸시 capability를 넣은 첫 빌드 번호로 맞춘다(그보다 낮은 iOS 판은 알림 허락을 묻지도 않는다). 새 iOS 빌드를 만들어 심사에 낸다.
4. Vercel 운영 환경 변수: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`(.p8 내용, 줄바꿈은 `\n`). 앱스토어·TestFlight 빌드는 기본(production) 그대로, Xcode로 직접 올린 개발 빌드를 시험하려면 `APNS_ENV=sandbox`. `APNS_TOPIC`은 기본이 번들 ID `kr.readme.app`.
   이 세 값이 있어야 앱이 iOS에서 알림 허락을 묻는다(없으면 iOS는 푸시를 아예 시도하지 않는다).
(Firebase Messaging을 iOS 앱에 넣는 길은 쓰지 않는다. 넣으면 FCM 토큰이 와서 기존 FCM 발송으로도 가지만 SDK·GoogleService-Info.plist·AppDelegate 연결이 더 필요하다.)

## 3. 앱 콘텐츠(정책) 답

> **2026-11-21부터 운영 서버는 '데모로 둘러보기'를 닫았다(DEMO_ENABLED, README·PLAN 참고). 아래 심사 메모·앱 액세스 안내는 이 버튼에 기댄다. 심사를 받는 동안은 Vercel 운영 환경 변수 `DEMO_ENABLED=1`로 켜 두거나(재배포 필요) 다른 심사용 로그인 방법을 안내해야 한다.**

| 항목 | 답 |
| --- | --- |
| 개인정보처리방침 | https://remember-you.watalabs.com/privacy-policy |
| 로그인 세부정보(옛 앱 액세스) | 제한된 부분 있음 > 이름 `Demo account (no sign-in)`, 아이디·비밀번호 비움, 기타 정보(영어): "No credentials needed. On the first screen tap \"Try the demo\" (Korean UI: \"데모로 둘러보기\"). It signs in to a demo account preloaded with 4 sample people, with access to every feature… Invite codes are only for opening a link someone sent; you can create one from the Sharing tab." |
| 광고 | 광고 없음 |
| 콘텐츠 등급 | 이메일 watalabs.help@gmail.com, 카테고리 '다른 모든 앱 유형'. 다운로드 콘텐츠의 등급 요소 아니요. 사용자 콘텐츠 공유 **예** → 사용자 콘텐츠가 주요 출처 예, 노출 공유 아니요, 실제 폭력 아니요, 차단 기능 예(보내기 끊기·사람 지우기), 신고 기능 아니요, 채팅 조정 아니요, 초대된 친구로만 제한 예. 온라인 콘텐츠 아니요, 연령 제한 상품 아니요, 위치 공유·디지털 구매·현금 보상·브라우저·뉴스/교육 모두 아니요. **결과: 대부분 12세 이상**(ESRB 청소년, PEGI 보호자 지도, 대한민국 12세 이상) + 사용자 상호작용. 사용자 콘텐츠가 주요 출처라서 올라감 |
| 타겟층 | 13~15세, 16~17세, 18세 이상(약관상 만 14세 이상. 18세 이상만 고르면 Play가 사용 가능 범위를 더 제한할 수 있다고 안내해서 맹고와 같게 둠) |
| 뉴스 앱 | 아니요 |
| 정부 앱 / 금융 기능 | 아니요 / 없음 |
| 건강 앱 | 건강 기능 없음(알레르기는 사용자가 적어 공유하는 정보일 뿐 건강 관리 기능이 아님. 데이터 보안에는 건강 정보로 신고) |
| 계정 삭제 | 앱 안에서 삭제 가능(공유 관리 > 계정 삭제), 웹 URL https://remember-you.watalabs.com/delete-account |
| 광고 ID | 사용 안 함(병합 매니페스트에 AD_ID 권한 없음) |
| 판매자 상태 | 예(개발자 계정 설정 상속), 서비스 약관 https://remember-you.watalabs.com/terms |
| 스토어 설정 | 카테고리 라이프스타일, 연락처 이메일·웹사이트는 API로 넣음 |

### 데이터 보안

- 데이터 수집: 예. 전송 중 암호화: 예. 계정 만들기: OAuth + 기타("Demo account: \"Try the demo\" creates a temporary anonymous account with no personal info. It is deleted automatically after 7 days."). 계정 삭제 URL https://remember-you.watalabs.com/delete-account, 일부 데이터 삭제 URL https://remember-you.watalabs.com/delete-account#partial(그 페이지의 '계정은 두고 일부만 지우기').
- **공유(제3자 제공): 없음.** 사용자가 직접 고른 사람에게 보여 주는 것과 위탁(Vercel·Supabase)은 Play 기준 '공유'가 아니다.

| 데이터 유형 | 수집 | 필수/선택 | 목적 |
| --- | --- | --- | --- |
| 개인 정보 > 이름 | 예 | 필수(부를 이름) | 앱 기능, 계정 관리 |
| 개인 정보 > 이메일 주소 | 예 | 필수(구글·애플 로그인 시, 데모는 없음) | 계정 관리 |
| 개인 정보 > 사용자 ID | 예 | 필수 | 앱 기능, 계정 관리 |
| 개인 정보 > 기타 정보(생일·기념일, 옷·신발 사이즈) | 예 | 선택 | 앱 기능 |
| 건강 및 피트니스 > 건강 정보(알레르기·못 먹는 음식) | 예 | 선택(별도 동의) | 앱 기능 |
| 앱 활동 > 앱 상호작용(누가 언제 봤는지 기록) | 예 | 필수 | 앱 기능 |
| 앱 활동 > 기타 사용자 생성 콘텐츠(취향·선물·나만 보는 메모) | 예 | 선택 | 앱 기능 |

모두 '수집됨', 임시 처리 아님. 이메일 주소는 목적 '계정 관리'만, 이름·사용자 ID는 '앱 기능, 계정 관리'.

수집하지 않음: 위치, 연락처(기기 주소록), 사진·동영상, 오디오(말로 입력은 기기 음성 인식이 처리), 금융 정보, 기기 ID(서버 푸시를 켜기 전까지), 웹 기록, 비정상 종료 로그.

## 4. 비공개 테스트 트랙

1. 테스트 및 출시 > 테스트 > 비공개 테스트 > 비공개 테스트 - Alpha > 테스터: **Google 그룹스** `readme-testers@googlegroups.com`(리드미 테스터, 웹 공개·누구나 가입, 회원 목록·게시는 관리자만) + `maengo-testers@googlegroups.com`. 트랙마다 이메일 목록과 Google 그룹 중 하나만 고를 수 있어서 처음 넣었던 이메일 목록(나·맹고테스터)은 2026-11-14에 그룹으로 바꿨다. 피드백 이메일 watalabs.help@gmail.com.
   - 테스터 안내: ① https://groups.google.com/g/readme-testers 에서 '그룹 가입' ② https://play.google.com/apps/testing/kr.readme.app 에서 '테스터 되기' ③ Play 스토어에서 설치(가입한 구글 계정과 폰의 Play 계정이 같아야 함)
2. 국가/지역: 대한민국.
3. 출시 노트(ko-KR): `리드미 첫 비공개 테스트예요. 내 리드미 적기·보내기·부탁하기·생일 알림을 써 보시고 불편한 점은 watalabs.help@gmail.com으로 알려 주세요. 로그인 없이 '데모로 둘러보기'로도 써 볼 수 있어요.` / en-US: `First closed test of README. Try writing, sharing and requesting a README and birthday reminders, and send feedback to watalabs.help@gmail.com. You can also tap "Try the demo" without signing in.`
4. 검토를 위해 전송. 2023-11-13 이후 만든 개인 개발자 계정이면 프로덕션 출시 전에 테스터 12명이 14일 동안 참여해야 한다.

## 5. 테스트 전에 확인

- [x] Vercel에 `GOOGLE_CLIENT_ID`·`GOOGLE_CLIENT_SECRET`(Google Cloud 프로젝트 `readme-514623`, 웹 클라이언트 `readme web`, 값 백업 `~/.readme/google-oauth.env`). **OAuth 앱 게시 상태를 '프로덕션'으로 바꿔야 아무 구글 계정이나 로그인된다**(Google 인증 플랫폼 > 대상 > 앱 게시).
- [x] Play 앱 서명 키 SHA-256을 Vercel `ANDROID_SHA256_FINGERPRINTS`에 더함(업로드 키와 쉼표로).

## 그래픽 다시 만들기

- 아이콘·실행 화면·그래픽 이미지: `node apps/mobile/scripts/make-assets.mjs`. 아이콘은 C안 '흘끔 다이어리'(크림 바탕, 망고 눈꺼풀 눈 둘 + 테이프 붙은 종이 쪽지, iOS 다크·틴트·안드로이드 테마 단색 포함), 실행 화면은 크림 #FBF6EA 단색 + 가운데 기억해U 로고 정지판(iOS LaunchScreen.storyboard·안드로이드 splash_icon), 그래픽 이미지는 같은 톤. 앱을 켜면 웹이 같은 자리에서 움직이는 로딩 덮개(apps/web/components/LaunchOverlay.tsx)로 이어받으니, 로고를 고치면 스크립트의 logoStack과 웹 .ry-* 스타일을 같이 고친다
- 스크린샷 1080×1920(한/영 6장씩, 운영 사이트 데모 계정): `node apps/mobile/scripts/store-screens.mjs`

## iOS App Store (2026-11-17 첫 심사 제출)

- App Store Connect 앱 ID 6834970170, 번들 kr.readme.app, 팀 QYS79FM739. 1.0(9)을 심사에 냄(자동 출시).
- 빌드 올리기: `cd apps/mobile && CAP_SERVER_URL=https://remember-you.watalabs.com npx cap sync ios`, 그다음 `ios/App`에서
  `xcodebuild archive -project App.xcodeproj -scheme App -configuration Release -destination generic/platform=iOS -archivePath <dir>/App.xcarchive -allowProvisioningUpdates`,
  `xcodebuild -exportArchive -archivePath <dir>/App.xcarchive -exportOptionsPlist <dir>/ExportOptions.plist -exportPath <dir>/export -allowProvisioningUpdates`
  (ExportOptions: method app-store-connect, destination upload, teamID QYS79FM739, signingStyle automatic). Xcode에 로그인된 계정으로 올라간다. 올릴 때마다 CURRENT_PROJECT_VERSION을 1씩 올린다.
- 아이폰 전용(TARGETED_DEVICE_FAMILY 1): 아이패드 스크린샷이 필요 없게. 스크린샷은 6.3형 1206×2622(운영 데모 계정으로 찍음).
- 판매: 무료, 대한민국만(EU DSA 판매자 공개·중국 규정 신고를 피함). 연령 등급 16+(술 선물 언급 드물게 → 13+, 약관 만 14세 이상이라 16+).
- 개인정보: 이름·이메일·건강(알레르기)·기타 사용자 콘텐츠·사용자 ID·기기 ID(앱 기능·분석), 제품 상호 작용(분석). 모두 사용자와 연결, 추적 안 함. 처리방침 /privacy-policy, 지원 /support.
- 심사 4.8: 애플로 로그인(Services ID kr.readme.app.web, 키 SKH7CXH449는 ~/.readme). 심사 메모: 로그인 없이 '데모로 둘러보기', 기기 기능(로컬 알림·음성 인식·Face ID·공유창), 계정 삭제, 쿠팡 제휴 고지.
- 심사 연락처: 이름 MinGyun Jeong, 이메일 watalabs.help@gmail.com, 전화는 Apple 개발자 계정 번호.
- iOS 푸시: 코드는 들어 있고(AppDelegate 토큰 전달, 서버 APNs 발송) APNs 키 + Xcode Push Notifications capability + 서버 환경 변수가 아직이다(위 '푸시' 절의 iOS 손일).
