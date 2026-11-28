// Play 스토어 등록정보(이름·설명·연락처)와 그래픽(아이콘·그래픽 이미지·휴대폰 스크린샷)을 올린다.
//   node apps/mobile/scripts/store/listing.mjs [--text-only]
// 그래픽은 apps/mobile/store/(make-assets.mjs, store-screens.mjs로 만든다). 문구를 바꾸면 STORE.md도 같이 고친다.
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { play, withEdit } from "./play.mjs";

const STORE = fileURLToPath(new URL("../../store/", import.meta.url));
const SITE = "https://remember-you.watalabs.com";
const EMAIL = "watalabs.help@gmail.com";

export const LISTINGS = {
  "ko-KR": {
    title: "기억해유",
    shortDescription: "소중한 사람 이야기를 메모하면, 기억해 둘 것은 정리하고 챙길 날을 알려 드려요",
    fullDescription: `말 안 해도 아는 사이처럼.

엄마가 좋아하는 꽃, 아내가 못 먹는 해산물, 아빠의 음력 생신, 단짝의 신발 사이즈.
알고 있다고 생각했는데, 막상 필요할 때는 기억이 안 나죠.
기억해유는 소중한 사람의 작은 것들을 대신 기억해 두는 앱이에요.

■ 메모 한 줄이면 돼요
가운데 메모 단추를 누르고 @엄마처럼 사람을 태그해 적어요. 마이크를 누르면 말이 바로 글로 써져요.

■ 사람마다 메모장
적은 메모는 그 사람의 메모장에 날짜별로 차곡차곡 쌓여요.

■ 기억해 둔 것은 알아서 정리
"엄마는 장미꽃 좋아해"라고 적으면 좋아하는 것들에 장미꽃이 들어가요. 알레르기와 못 먹는 음식, 매운맛, 옷·신발 사이즈, 생일과 기념일까지 한눈에 보고, 얼마나 채웠는지도 알려 줘요.

■ 다른 메모 앱에서 가져오기
삼성 노트나 Keep 같은 메모 앱에서 공유를 누르고 기억해유를 고르면 바로 메모로 담겨요. 메모를 찍은 사진에서 글자를 읽어 올 수도 있어요.

■ 모르는 건 링크 하나로 물어보기
링크를 보내면 앱이 없어도 답할 수 있어요. 아는 건 미리 채워 보내니 확인만 하면 되고, 답장은 기억해 둔 것에 바로 들어와요.

■ 적어 둔 걸 보고 선물 고르기
1만원대부터 10만원 이상까지 가격대별로 골라 줘요. 알레르기나 안 마시는 술처럼 피해야 하는 건 빼고요.

■ 챙길 날을 잊지 않게
음력 생일도 올해 양력 날짜로 바꿔서, 고른 때에 알려 드려요. 메모에 "다음 주 토요일 꽃시장"처럼 날짜를 적으면 챙길 날에도 넣어 둬요. 설·추석 같은 명절 알림도 켤 수 있어요.

■ 나만 보는 기록
· 메모와 기억해 둔 것은 나만 봐요
· 알레르기·사이즈·기념일·메모는 암호화해서 보관해요
· 앱 잠금(지문·얼굴)을 켤 수 있어요
· 언제든 내 정보를 내려받거나 계정을 지울 수 있어요

구글이나 애플 계정으로 로그인해요.
기기 언어에 맞춰 한국어나 영어로 보여요.`,
  },
  "en-US": {
    title: "Remember You",
    shortDescription: "Memo about the people you love; we sort it and remind you of their day.",
    fullDescription: `Know each other without a word.

Mom's favorite flowers, the seafood your partner can't eat, Dad's lunar birthday, your best friend's shoe size.
You think you remember, until the moment you need it.
Remember You keeps the little things about the people you love.

■ One line is enough
Tap the memo button, tag someone like @Mom and write. Tap the mic and your words are typed for you.

■ A notebook for each person
Your memos stack up by date in that person's notebook.

■ What you remember, sorted for you
Write "Mom loves roses" and roses go into her favorites. See allergies and foods to avoid, spice level, clothing and shoe sizes, birthdays and anniversaries at a glance, plus how much you've filled in.

■ Bring notes from other apps
Share a note from Samsung Notes, Keep or another notes app to Remember You and it becomes a memo. You can also read the text from a photo of a note.

■ Not sure? Just ask
Send one link and they can answer on the web, no app needed. What you already know is filled in for them to check, and the reply lands in what you remember.

■ Gift ideas from your notes
Picks by price range, leaving out allergies and drinks they skip.

■ Never miss a special day
Lunar birthdays are converted to this year's date, with reminders when you choose. Write a date in a memo like "flower market next Saturday" and it's added to your dates too. Holiday reminders are available as well.

■ Only for you
· Your memos and what you remember are visible only to you
· Allergies, sizes, dates and memos are encrypted
· Optional app lock (fingerprint or face)
· Download your data or delete your account any time

Sign in with Google or Apple.
Shown in Korean or English to match your device.`,
  },
};

const textOnly = process.argv.includes("--text-only");
const png = (p) => readFileSync(`${STORE}${p}`);

const { commit } = await withEdit(async (e) => {
  await play("PUT", `${e}/details`, { defaultLanguage: "ko-KR", contactEmail: EMAIL, contactWebsite: SITE });
  for (const [language, l] of Object.entries(LISTINGS)) {
    for (const [k, v, max] of [
      ["title", l.title, 30],
      ["shortDescription", l.shortDescription, 80],
      ["fullDescription", l.fullDescription, 4000],
    ]) {
      if ([...v].length > max) throw new Error(`${language} ${k} ${[...v].length} > ${max}`);
    }
    await play("PUT", `${e}/listings/${language}`, { language, ...l });
    console.log("listing", language);
    if (textOnly) continue;
    const dir = language === "ko-KR" ? "ko" : "en";
    await play("POST", `${e}/listings/${language}/icon`, png("icon-512.png"), { upload: true, contentType: "image/png" });
    await play("DELETE", `${e}/listings/${language}/featureGraphic`).catch(() => {});
    await play("POST", `${e}/listings/${language}/featureGraphic`, png("feature-1024x500.png"), { upload: true, contentType: "image/png" });
    await play("DELETE", `${e}/listings/${language}/phoneScreenshots`).catch(() => {});
    for (const f of readdirSync(`${STORE}screens/${dir}`).filter((f) => f.endsWith(".png")).sort()) {
      await play("POST", `${e}/listings/${language}/phoneScreenshots`, png(`screens/${dir}/${f}`), { upload: true, contentType: "image/png" });
    }
    console.log("images", language);
  }
});
console.log("commit", commit);
