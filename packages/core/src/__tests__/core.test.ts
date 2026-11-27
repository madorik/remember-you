import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ageLine,
  groupMemo,
  judgeMenus,
  mealBrief,
  orderNote,
  ageOn,
  applyAnswer,
  canAnswerOwn,
  describeRing,
  describeShoe,
  describeTop,
  dueReminders,
  dueWithCatchUp,
  eventTitle,
  en,
  countWord,
  formatDaysLeft,
  formatSpec,
  hashToken,
  NONE,
  isAnswered,
  inviteStatus,
  isEmptySection,
  josa,
  ko,
  normalizeCode,
  parseFoodSpeech,
  placeholders,
  questionForPeople,
  questionsLeft,
  questionsUsedToday,
  isCloseEnough,
  mostRecentlyViewed,
  isRecentlyAdded,
  RECENT_PERSON_DAYS,
  CLOSE_VIEW_DAYS,
  DAILY_QUESTION_LIMIT,
  QUESTION_SECTION,
  aboutPrompt,
  QUESTIONS,
  randomCode,
  randomToken,
  RELATION_PRESETS,
  safeUrl,
  sanitizeAvatar,
  sanitizeOffsets,
  sanitizeSection,
  sanitizeSections,
  shoeUs,
  translate,
  zodiacOf,
  upcomingEvents,
  type MessageKey,
} from "../index";

const TODAY = { y: 2026, m: 11, d: 13 };

test("한·영 문구: 같은 키, 같은 변수", () => {
  const koKeys = Object.keys(ko).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, koKeys);
  for (const key of koKeys as MessageKey[]) {
    assert.deepEqual(placeholders(en[key]), placeholders(ko[key]), key);
    assert.ok(en[key].length > 0, key);
  }
});

test("조사: 받침에 맞춰", () => {
  assert.equal(josa("어머니 생일", "이에요"), "어머니 생일이에요");
  assert.equal(josa("데이트", "이에요"), "데이트예요");
  assert.equal(josa("지수", "이"), "지수가");
  assert.equal(josa("서울", "으로"), "서울로");
  assert.equal(josa("집", "으로"), "집으로");
  assert.equal(translate("ko", "home.today", { event: "결혼기념일" }), "오늘은 결혼기념일이에요");
  assert.equal(translate("en", "home.today", { event: "Mom's birthday" }), "Mom's birthday is today");
});

test("카드 정리: 모르는 코드·위험한 주소는 버린다(알레르기·안 먹는 것의 목록에 없는 이름은 새 항목)", () => {
  const safety = sanitizeSection("safety", { allergens: ["shrimp", "crab", "키위", "shrimp", 7, ""], dislikes: ["cucumber"], diets: ["vegan", "keto", 3], extra: 1 });
  assert.deepEqual(safety, { allergens: ["shrimp", "crab", "키위"], allergyNote: "", dislikes: ["cucumber"], diets: ["vegan"] });
  const gifts = sanitizeSection("gifts", {
    wishlist: [
      { title: "캠핑 의자", url: "javascript:alert(1)" },
      { title: "도자기 클래스", url: "example.com/class" },
      { title: "", url: "https://x.y" },
    ],
    giftCard: "maybe",
  });
  assert.deepEqual(gifts.wishlist, [
    { title: "캠핑 의자", url: "" },
    { title: "도자기 클래스", url: "https://example.com/class" },
  ]);
  assert.equal(gifts.giftCard, null);
  // 좋아하는 색은 좋아하는 것들 칸에(모르는 색은 버리고 다섯 개까지)
  assert.deepEqual(sanitizeSection("favorites", { colors: ["sage", "cream", "bogus", "orange"] }).colors, ["sage", "cream", "orange"]);
  assert.equal((sanitizeSection("gifts", { colors: ["red"] }) as unknown as Record<string, unknown>).colors, undefined);
  assert.equal(safeUrl("data:text/html,hi"), "");
});

test("카드 정리: 숫자 범위와 날짜", () => {
  const sizes = sanitizeSection("sizes", { top: " 55 ", shoe: "235", ring: 99, bottom: "26" });
  assert.deepEqual(sizes, { top: "55", bottom: "26", shoe: 235, ring: null });
  const dates = sanitizeSection("dates", {
    birthday: { calendar: "lunar", month: 10, day: 12, leap: "x" },
    anniversaries: [{ label: "결혼기념일", spec: { calendar: "solar", month: 5, day: 18 } }, { label: "", spec: { calendar: "solar", month: 1, day: 1 } }],
  });
  assert.equal(dates.birthday, null, "leap이 불리언이 아니면 버린다");
  assert.equal(dates.anniversaries.length, 1);
  const taste = sanitizeSection("taste", { likes: "마라탕, 떡볶이,마라탕", spicy: 3 });
  assert.deepEqual(taste, { likes: ["마라탕", "떡볶이"], spicy: 3, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } });
  assert.equal(isEmptySection("taste", taste), false);
  assert.equal(isEmptySection("sizes", sanitizeSection("sizes", {})), true);
});

test("관계별 기본 공개 항목", () => {
  assert.deepEqual(RELATION_PRESETS.family, ["safety", "taste", "sizes", "favorites", "culture", "life", "pets", "dates"]);
  assert.deepEqual(sanitizeSections(["dates", "safety", "bogus", "dates"]), ["safety", "dates"]);
});

test("사이즈 환산", () => {
  assert.equal(shoeUs(235), "6.5");
  assert.equal(shoeUs(240), "7");
  assert.deepEqual(describeShoe(235, "en"), { value: "235", unit: "mm", hint: "About US women's 6.5" });
  assert.deepEqual(describeRing(11, "en"), { value: "11", unit: "KR", hint: "About US 6" });
  assert.deepEqual(describeTop("55", "en"), { value: "55", unit: "KR", hint: "About US S" });
  assert.deepEqual(describeTop("55", "ko"), { value: "55", unit: "S", hint: null });
});

test("다가오는 날과 오늘 보낼 알림", () => {
  const events = upcomingEvents(
    [
      { contactId: "mom", name: "어머니", birthday: { calendar: "lunar", month: 10, day: 12 } },
      { contactId: "jisu", name: "지수", birthday: { calendar: "solar", month: 12, day: 3 }, anniversaries: [{ label: "결혼기념일", spec: { calendar: "solar", month: 5, day: 18 } }] },
      { contactId: "dad", name: "아버지", birthday: { calendar: "lunar", month: 11, day: 3 } },
    ],
    TODAY,
  );
  assert.deepEqual(
    events.map((e) => [e.contactId, e.kind, e.daysUntil]),
    [
      ["mom", "birthday", 7],
      ["jisu", "birthday", 20],
      ["dad", "birthday", 28],
      ["jisu", "anniversary", 186],
    ],
  );
  const due = dueReminders(events, [7, 0]);
  assert.equal(due.length, 1);
  assert.equal(due[0]!.event.contactId, "mom");
  assert.deepEqual(sanitizeOffsets([7, 5, 0, "3"]), [7, 0]);
});

test("알림 시점: 어제 못 보낸 것도 오늘 보내고(아직 안 지난 것만), 같은 것이 두 번 나오지 않는다(날이 바뀌어도 한 알림은 한 번)", () => {
  const people = [{ contactId: "mom", name: "어머니", birthday: { calendar: "solar" as const, month: 12, day: 3 } }];
  const left = (y: number, m: number, d: number) => dueWithCatchUp(people, { y, m, d }, [7, 0]).map((x) => [x.offset, x.event.date.m, x.event.date.d]);
  // 12/3 생일의 7일 전은 11/26: 그날은 한 번만
  assert.deepEqual(left(2026, 11, 26), [[7, 12, 3]]);
  // 11/27(어제 크론이 못 돌았다고 치면): 어제 알렸어야 할 7일 전 알림이 오늘 나간다
  assert.deepEqual(left(2026, 11, 27), [[7, 12, 3]]);
  // 11/28이면 이틀 전 것이라 더는 보내지 않는다(하루만 만회)
  assert.deepEqual(left(2026, 11, 28), []);
  // 생일 당일은 당일 알림, 그다음 날엔 어제 당일 알림을 만회하지 않는다(이미 지난 날이다)
  assert.deepEqual(left(2026, 12, 3), [[0, 12, 3]]);
  assert.deepEqual(left(2026, 12, 4), []);
});

test("날짜 표기", () => {
  assert.equal(formatSpec({ calendar: "lunar", month: 10, day: 12 }, "ko"), "음력 10월 12일");
  assert.equal(formatSpec({ calendar: "lunar", month: 5, day: 1, leap: true }, "en"), "Lunar leap 5/1");
  assert.equal(formatSpec({ calendar: "solar", month: 12, day: 3 }, "en"), "Dec 3");
  assert.equal(formatDaysLeft(0, "ko"), "오늘");
  assert.deepEqual([1, 2, 3, 4, 5, 10, 11, 20, 21, 34].map((n) => countWord(n, "ko")), ["한", "두", "세", "네", "다섯", "열", "열한", "스무", "스물한", "서른네"]);
  assert.equal(countWord(100, "ko"), "100");
  assert.equal(countWord(3, "en"), "3");
  assert.equal(formatDaysLeft(7, "en"), "In 7 days");
});

test("오늘의 질문: 하루 두 번까지만, 날이 바뀌면 다시 센다", () => {
  assert.equal(DAILY_QUESTION_LIMIT, 2);
  assert.equal(questionsLeft(0), 2);
  assert.equal(questionsLeft(1), 1);
  assert.equal(questionsLeft(2), 0);
  assert.equal(questionsLeft(9), 0, "넘게 센 값도 음수가 되지 않는다");
  assert.equal(questionsLeft(Number.NaN), 2);
  const today = { y: 2026, m: 11, d: 21 };
  assert.equal(questionsUsedToday({ questionDay: "2026-11-21", questionCount: 2 }, today), 2);
  assert.equal(questionsUsedToday({ questionDay: "2026-11-20", questionCount: 2 }, today), 0, "어제 센 것은 오늘 세지 않는다");
  assert.equal(questionsUsedToday({ questionDay: null, questionCount: 0 }, today), 0);
});

test("오늘의 질문: 가까운 사람에게만(가족·연인 폴더, 즐겨찾기, 여러 날 열어 본 사람) 묻고, 다시 묻지 않기는 늘 뺀다", () => {
  const base = { askOff: false, favorite: false, closeFolder: false, viewDays: 0 };
  assert.equal(isCloseEnough(base), false, "그냥 적어 둔 사람");
  assert.equal(isCloseEnough({ ...base, closeFolder: true }), true);
  assert.equal(isCloseEnough({ ...base, favorite: true }), true);
  assert.equal(isCloseEnough({ ...base, viewDays: CLOSE_VIEW_DAYS - 1 }), false);
  assert.equal(isCloseEnough({ ...base, viewDays: CLOSE_VIEW_DAYS }), true);
  assert.equal(isCloseEnough({ askOff: true, favorite: true, closeFolder: true, viewDays: 99 }), false, "다시 묻지 않기가 이긴다");
  assert.equal(isCloseEnough({ ...base, recent: true }), true, "방금 더한 사람(말로 적다가 생긴 사람)은 폴더가 없어도 묻는다");
  assert.equal(isCloseEnough({ ...base, askOff: true, recent: true }), false, "방금 더한 사람도 다시 묻지 않기는 뺀다");
});

test("가장 최근에 사람 화면을 연 사람: 연 날 늦은 순 → 연 날 수 많은 순 → 목록 앞선 순, 연 적 없으면 맨 뒤", () => {
  const mk = (id: string, viewedOn: string | null, viewDays: number) => ({ id, viewedOn, viewDays });
  assert.equal(mostRecentlyViewed([]), null);
  assert.equal(mostRecentlyViewed([mk("a", null, 0), mk("b", null, 0)])?.id, "a", "연 적이 없으면 목록 첫 사람");
  assert.equal(mostRecentlyViewed([mk("a", null, 0), mk("b", "2026-11-20", 1)])?.id, "b", "연 적 없는 사람은 뒤로");
  assert.equal(mostRecentlyViewed([mk("a", "2026-11-25", 1), mk("b", "2026-11-26", 1), mk("c", "2026-11-20", 9)])?.id, "b", "가장 늦게 연 사람");
  assert.equal(mostRecentlyViewed([mk("a", "2026-11-26", 2), mk("b", "2026-11-26", 5), mk("c", "2026-11-26", 5)])?.id, "b", "같은 날이면 많이 연 사람, 그래도 같으면 앞선 사람");
});

test("오늘의 질문: 더한 지 14일 안 된 사람만 '방금 더한 사람'", () => {
  const now = Date.parse("2026-11-23T12:00:00Z");
  const ago = (days: number) => new Date(now - days * 86_400_000).toISOString();
  assert.equal(isRecentlyAdded(ago(0), now), true);
  assert.equal(isRecentlyAdded(ago(RECENT_PERSON_DAYS - 1), now), true);
  assert.equal(isRecentlyAdded(ago(RECENT_PERSON_DAYS), now), false);
  assert.equal(isRecentlyAdded(ago(-1), now), false, "미래 날짜는 아니다");
  assert.equal(isRecentlyAdded(null, now), false);
  assert.equal(isRecentlyAdded("모르는 값", now), false);
});

test("오늘의 질문: 남은 칸이 하나뿐인데 이미 하나 처리했으면 같은 질문을 또 묻지 않고, 물어보기는 그 질문의 항목 하나로", () => {
  const full = {
    taste: { likes: [], spicy: 2, dessert: "", drinks: "", alcohol: { level: null, kinds: [] } },
    gifts: { giftCard: "yes" as const, wishlist: [], skip: [], brands: [] },
    life: sanitizeSection("life", { seasons: ["autumn"] }),
    favorites: sanitizeSection("favorites", { scent: "우디", flowers: "튤립", patterns: ["stripe"], metals: ["silver"], styles: ["minimal"] }),
    culture: sanitizeSection("culture", { musicGenres: ["indie"], movieGenres: ["comedy"] }),
  };
  const dad = [{ contactId: "dad", card: full }];
  assert.equal(questionForPeople(TODAY, dad, 0)?.question.id, "drinks");
  assert.equal(questionForPeople(TODAY, dad, 1), null);
  for (const q of QUESTIONS) assert.ok(QUESTION_SECTION[q.id], q.id);
  assert.equal(QUESTION_SECTION.drinks, "taste");
  assert.equal(QUESTION_SECTION.giftCard, "gifts");
});

test("오늘의 질문: 등록한 사람 중 답이 없는 칸을 하나씩, 답한 건 건너뛰고, 답은 그 사람 카드 칸에", () => {
  // 사람이 없으면 물을 게 없다
  assert.equal(questionForPeople(TODAY, []), null);
  const full = {
    taste: { likes: [], spicy: 2, dessert: "", drinks: "라떼", alcohol: { level: null, kinds: [] } },
    gifts: { giftCard: "yes" as const, wishlist: [], skip: [], brands: [] },
    life: sanitizeSection("life", { seasons: ["autumn"] }),
    favorites: sanitizeSection("favorites", { scent: "우디", flowers: "튤립", patterns: ["stripe"], metals: ["silver"], styles: ["minimal"] }),
    culture: sanitizeSection("culture", { musicGenres: ["indie"], movieGenres: ["comedy"] }),
  };
  // 모두 답한 사람만 있으면 null, 한 사람이라도 빈 칸이 있으면 그 사람 이야기를 묻는다
  assert.equal(questionForPeople(TODAY, [{ contactId: "mom", card: full }]), null);
  const only = questionForPeople(TODAY, [{ contactId: "mom", card: full }, { contactId: "dad", card: {} }]);
  assert.equal(only?.contactId, "dad");
  // 답한 칸은 다시 묻지 않는다: 아빠가 음료만 비었으면 음료 질문
  const oneLeft = questionForPeople(TODAY, [{ contactId: "dad", card: { ...full, taste: { ...full.taste, drinks: "" } } }]);
  assert.equal(oneLeft?.question.id, "drinks");
  // 하루 한 칸씩 옮겨 가고, 건너뛰기를 누르면 그만큼 더 옮긴다
  const dad = [{ contactId: "dad", card: {} }];
  const a = questionForPeople(TODAY, dad, 0);
  const b = questionForPeople(TODAY, dad, 1);
  assert.ok(a && b && a.question.id !== b.question.id);
  assert.equal(questionForPeople(TODAY, dad, QUESTIONS.length)?.question.id, a.question.id, "한 바퀴 돌면 처음으로");
  // 사람 이름이 든 질문: 받침에 따라 은/는, 이름 없으면 '이 사람'
  assert.equal(aboutPrompt("scent", "엄마", "ko"), "엄마는 어떤 향을 좋아해요?");
  assert.equal(aboutPrompt("scent", "아빠", "ko"), "아빠는 어떤 향을 좋아해요?");
  assert.equal(aboutPrompt("scent", "철수", "ko"), "철수는 어떤 향을 좋아해요?");
  assert.equal(aboutPrompt("scent", "영민", "ko"), "영민은 어떤 향을 좋아해요?");
  assert.equal(aboutPrompt("flowers", "엄마", "en"), "Which flowers would 엄마 like?");
  assert.equal(aboutPrompt("style", "  ", "ko"), "이 사람의 평소 옷 스타일은 어때요?");
  for (const q of QUESTIONS) assert.ok(aboutPrompt(q.id, "엄마", "ko").includes("엄마") && aboutPrompt(q.id, "Mom", "en").includes("Mom"), q.id);
  assert.deepEqual(applyAnswer({}, "drinks", "아메리카노"), { taste: { likes: [], spicy: null, dessert: "", drinks: "아메리카노", alcohol: { level: null, kinds: [] } } });
  assert.equal(applyAnswer({}, "giftCard", "no").gifts?.giftCard, "no");
  // 향·꽃은 취향 칸으로
  assert.equal(applyAnswer({}, "flowers", "튤립").favorites?.flowers, "튤립");
  assert.equal(applyAnswer({}, "scent", "우디").favorites?.scent, "우디");
  // 보기에 없는 답은 직접: 음료·꽃·향은 그 칸에, 음악은 즐겨 듣는 노래, 영화는 인생 영화로(보기 코드는 그대로 장르로)
  assert.equal(canAnswerOwn("drinks"), true);
  assert.equal(canAnswerOwn("pattern"), false);
  assert.equal(applyAnswer({}, "drinks", "보리차").taste?.drinks, "보리차");
  assert.equal(applyAnswer({}, "musicGenre", "재즈").culture?.song, "재즈");
  assert.deepEqual(applyAnswer({}, "musicGenre", "재즈").culture?.musicGenres, []);
  assert.deepEqual(applyAnswer({}, "musicGenre", "indie").culture?.musicGenres, ["indie"]);
  assert.equal(applyAnswer({}, "movieGenre", "인터스텔라").culture?.movie, "인터스텔라");
  assert.equal(isAnswered({ culture: sanitizeSection("culture", { song: "재즈" }) }, "musicGenre"), true);
});

test("초대 토큰과 코드", async () => {
  const a = randomToken();
  const b = randomToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.match(await hashToken(a), /^[0-9a-f]{64}$/);
  assert.equal(await hashToken("x"), await hashToken("x"));
  const code = randomCode();
  assert.match(code, /^[A-HJKMNP-Z2-9]{6}$/);
  assert.equal(normalizeCode(` ${code.slice(0, 3).toLowerCase()}-${code.slice(3)} `), code);
  assert.equal(normalizeCode("ABC0EF"), null);
  const now = new Date("2026-11-13T00:00:00Z");
  assert.equal(inviteStatus({ expires_at: "2026-11-20T00:00:00Z", used_at: null, canceled_at: null }, now), "active");
  assert.equal(inviteStatus({ expires_at: "2026-11-12T00:00:00Z", used_at: null, canceled_at: null }, now), "expired");
  assert.equal(inviteStatus({ expires_at: "2026-11-20T00:00:00Z", used_at: "x", canceled_at: null }, now), "used");
});

test("아바타 값 정리", () => {
  // 모르는 값은 기본값으로
  assert.deepEqual(sanitizeAvatar({ hair: "mohawk", face: "star", body: "robe", item: "sword", glasses: "yes", bg: "red", cloth: "#000", hairColor: "#000", skin: "#00FF00" }), {
    hair: "short",
    face: "oval",
    body: "shirt",
    item: "none",
    glasses: "none",
    bg: "sky",
    cloth: "#FFFFFF",
    hairColor: "#1F2340",
    skin: "#FFFFFF",
  });
  // 새 값은 그대로
  const v3 = { hair: "perm", face: "round", body: "cardigan", item: "earrings", glasses: "sun", bg: "rose", cloth: "#E7D3B0", hairColor: "#FFFFFF", skin: "#E8B88F" };
  assert.deepEqual(sanitizeAvatar(v3), v3);
  // 얼굴형·피부가 없던 예전 값은 달걀형·흰 얼굴로
  assert.deepEqual(sanitizeAvatar({ hair: "bangs", body: "knit", item: "pencil", glasses: "sun", bg: "lilac", cloth: "#FF9DB0", hairColor: "#D9A15B" }), {
    hair: "bangs",
    face: "oval",
    body: "knit",
    item: "pencil",
    glasses: "sun",
    bg: "lilac",
    cloth: "#FF9DB0",
    hairColor: "#D9A15B",
    skin: "#FFFFFF",
  });
  // 예전(v2) 값은 읽을 때 새 값으로: 옷 톤 → 배경·옷 색, 안경 켬 → 동그란 안경, 아주 짧게 → 짧은 머리
  assert.deepEqual(sanitizeAvatar({ tone: "blue", skin: "#F2CDB0", hair: "crop", hairColor: "#9A98A3", glasses: true }), {
    hair: "short",
    face: "oval",
    body: "shirt",
    item: "none",
    glasses: "round",
    bg: "sky",
    cloth: "#1F2340",
    hairColor: "#A3A8BC",
    skin: "#FFFFFF",
  });
  // 하늘색 시절 옷·머리색은 맹고색으로
  assert.equal(sanitizeAvatar({ cloth: "#8CC8FF", hairColor: "#22304A" }).cloth, "#FFC23D");
  assert.equal(sanitizeAvatar({ cloth: "#8CC8FF", hairColor: "#22304A" }).hairColor, "#1F2340");
});

test("말로 입력: 알레르기와 못 먹는 것을 나눠 찾는다", () => {
  assert.deepEqual(parseFoodSpeech("나 오이 싫어하고 새우 알레르기 있어"), { allergens: ["shrimp"], dislikes: ["cucumber"] });
  assert.deepEqual(parseFoodSpeech("고수랑 곱창은 못 먹어요. 게임은 좋아해요"), { allergens: [], dislikes: ["cilantro", "offal"] });
  assert.deepEqual(parseFoodSpeech("I'm allergic to peanuts and I hate cilantro"), { allergens: ["peanut"], dislikes: ["cilantro"] });
  assert.deepEqual(parseFoodSpeech("게 알러지 있고 굴도 안 먹어"), { allergens: ["crab"], dislikes: ["oyster"] });
  assert.deepEqual(parseFoodSpeech(""), { allergens: [], dislikes: [] });
});

test("생년월일: 만 나이·띠·큰 생일·기념일 N주년(음력은 음력 연도)", () => {
  // 양력 1990-11-20: 오늘(2026-11-13) 기준 아직 생일 전이라 만 35세, 말띠
  const solar = { calendar: "solar" as const, month: 11, day: 20, year: 1990 };
  assert.equal(ageOn(solar, TODAY), 35);
  assert.equal(zodiacOf(solar)?.ko, "말");
  assert.equal(ageLine(solar, TODAY, "ko"), "만 35세 · 말띠");
  assert.equal(ageLine({ calendar: "solar", month: 11, day: 20 }, TODAY, "ko"), "");
  // 생일이 오늘이면 오늘 바뀐 나이
  assert.equal(ageOn({ calendar: "solar", month: 11, day: 13, year: 1990 }, TODAY), 36);
  // 1월생은 음력 설 전이면 전 해 띠: 1990-01-20(양력)은 음력 1989년 → 뱀띠
  assert.equal(zodiacOf({ calendar: "solar", month: 1, day: 20, year: 1990 })?.ko, "뱀");
  // 음력 1956년 10월 13일생: 올해 음력 10.13(양력 2026-11-21)에 만 70세 → 칠순
  const lunar = { calendar: "lunar" as const, month: 10, day: 13, leap: false, year: 1956 };
  assert.equal(ageOn(lunar, TODAY), 69);
  assert.equal(eventTitle("ko", { kind: "birthday", name: "엄마", spec: lunar, date: { y: 2026, m: 11, d: 21 } }), "엄마 칠순");
  assert.equal(eventTitle("en", { kind: "birthday", name: "Mom", spec: lunar, date: { y: 2026, m: 11, d: 21 } }), "Mom's 70th birthday");
  assert.equal(eventTitle("ko", { kind: "birthday", name: "아빠", spec: solar, date: { y: 2026, m: 11, d: 20 } }), "아빠 생일");
  // 기념일: 연도를 알면 N주년
  const wedding = { calendar: "solar" as const, month: 5, day: 2, year: 2016 };
  assert.equal(eventTitle("ko", { kind: "anniversary", name: "지수", label: "결혼기념일", spec: wedding, date: { y: 2027, m: 5, d: 2 } }), "지수 결혼기념일 11주년");
  // 연도는 1900~2100만, 숫자가 아니면 버린다
  assert.equal(sanitizeSection("dates", { birthday: { calendar: "solar", month: 3, day: 1, year: 1800 } }).birthday, null);
  assert.deepEqual(sanitizeSection("dates", { birthday: { calendar: "solar", month: 2, day: 29, year: 1996 } }).birthday, { calendar: "solar", month: 2, day: 29, year: 1996 });
  assert.equal(sanitizeSection("dates", { birthday: { calendar: "solar", month: 2, day: 29, year: 1997 } }).birthday, null);
});

test("새 칸: 술·브랜드는 정해진 코드와 모양만 남긴다", () => {
  const taste = sanitizeSection("taste", { alcohol: { level: "some", kinds: ["wine", "beer", "nope"] } });
  assert.deepEqual(taste.alcohol, { level: "some", kinds: ["wine", "beer"] });
  // 안 마신다면 종류는 비운다
  assert.deepEqual(sanitizeSection("taste", { alcohol: { level: "none", kinds: ["soju"] } }).alcohol, { level: "none", kinds: [] });
  // 예전 데이터(술 칸 없음)도 읽힌다
  assert.deepEqual(sanitizeSection("taste", { likes: ["떡볶이"] }).alcohol, { level: null, kinds: [] });
  assert.deepEqual(sanitizeSection("gifts", { brands: "무인양품, 이솝" }).brands, ["무인양품", "이솝"]);
});

test("같이 고르기: 알레르기·식단은 빼고, 안 먹는 것·너무 매운 건 아쉬운 메뉴, 좋아하는 메뉴가 앞에", () => {
  const all = ["safety", "taste", "sizes", "gifts", "dates"] as const;
  const wife = { key: "w", name: "지수", sections: all, card: { safety: sanitizeSection("safety", { allergens: ["shrimp", "crab"], dislikes: ["cilantro"] }), taste: sanitizeSection("taste", { likes: ["마라탕", "연어 초밥", "크림 파스타"], spicy: 3 }) } };
  const friend = { key: "f", name: "준호", sections: all, card: { safety: sanitizeSection("safety", { allergens: ["peanut"] }), taste: sanitizeSection("taste", { likes: ["곱창", "평양냉면"], spicy: 4, alcohol: { level: "none" } }) } };
  const mom = { key: "m", name: "엄마", sections: ["safety", "taste"] as const, card: { safety: sanitizeSection("safety", { dislikes: ["raw"], diets: [] }), taste: sanitizeSection("taste", { spicy: 1 }) } };
  const v = judgeMenus([wife, friend, mom]);
  const by = (code: string) => v.find((x) => x.item.code === code)!;
  assert.equal(by("seafood_stew").status, "avoid");
  assert.equal(by("malatang").status, "avoid"); // 땅콩(준호), 지수가 좋아해도
  assert.deepEqual(by("malatang").likedBy, ["지수"]);
  assert.equal(by("sushi").status, "soft"); // 엄마는 날것 안 먹음
  assert.equal(by("jokbal").status, "avoid"); // 새우젓
  assert.equal(by("gopchang").status, "ok");
  assert.equal(by("gopchang").milder, true); // 엄마 매운맛 1
  // 다 같이 먹을 수 있고 좋아하는 사람이 있는 메뉴가 맨 앞(덜 맵게가 필요 없는 것 먼저)
  assert.deepEqual(v.slice(0, 2).map((x) => x.item.code), ["naengmyeon", "pasta"]);
  // 볼 수 없는 항목은 쓰지 않는다
  const hidden = judgeMenus([{ ...wife, sections: ["dates"] as const }]);
  assert.equal(hidden.find((x) => x.item.code === "seafood_stew")!.status, "ok");
  // 식당에 말할 것(이름 없이), 같이 가는 사람에게 보낼 메모(이름은 고를 때만)
  const brief = mealBrief([wife, friend, mom]);
  assert.equal(orderNote(brief, "ko"), "새우, 게, 땅콩은 빼 주세요(알레르기). 고수, 날것도 빼 주세요. 덜 맵게 해 주세요.");
  const memo = groupMemo(brief, "ko");
  assert.ok(memo.includes("알레르기: 새우, 게, 땅콩") && !memo.includes("지수"));
  assert.ok(groupMemo(brief, "ko", true).includes("새우(지수)"));
  assert.ok(memo.includes("안 마시는 사람이 있어요"));
  // 채식이면 채식으로 시킬 수 있는 메뉴만
  const veg = { key: "v", name: "채식", sections: all, card: { safety: sanitizeSection("safety", { diets: ["vegan"] }) } };
  assert.deepEqual(judgeMenus([veg]).filter((x) => x.status === "ok").map((x) => x.item.code), ["salad"]);
});

test("좋아하는 것들·생활과 여행: 고르는 칸은 정해진 코드만, 적는 칸은 글. 오늘의 질문 답은 그 칸에 더한다", () => {
  const f = sanitizeSection("favorites", { patterns: ["stripe", "nope"], idol: " 아이유 ", seasons: ["autumn"] });
  assert.deepEqual(f.patterns, ["stripe"]);
  assert.equal(f.idol, "아이유");
  assert.equal((f as unknown as Record<string, unknown>).seasons, undefined, "계절은 생활과 여행 칸으로 옮겼다");
  assert.equal(isEmptySection("favorites", sanitizeSection("favorites", {})), true);
  assert.equal(isEmptySection("favorites", f), false);
  const l = sanitizeSection("life", { seasons: ["autumn", "nope"], travel: " 교토 ", book: 3, dessert: "케이크", animal: "고양이" });
  assert.deepEqual(l, { hobbies: [], seasons: ["autumn"], travel: "교토" }, "디저트는 좋아하는 음식, 동물은 좋아하는 것들, 책은 문화생활로 옮겼다");
  assert.equal(isEmptySection("life", sanitizeSection("life", {})), true);
  // 취미는 선물에서 생활과 여행으로 옮겼다
  assert.deepEqual(sanitizeSection("life", { hobbies: [" 등산 ", "캠핑"] }).hobbies, ["등산", "캠핑"]);
  assert.equal(isEmptySection("life", sanitizeSection("life", { hobbies: ["등산"] })), false);
  assert.equal((sanitizeSection("gifts", { loves: ["등산"] }) as unknown as Record<string, unknown>).loves, undefined);
  const added = applyAnswer({ life: l }, "season", "winter").life!;
  assert.deepEqual(added.seasons, ["autumn", "winter"]);
  assert.equal(added.travel, "교토");
  assert.deepEqual(applyAnswer({}, "metal", "gold").favorites?.metals, ["gold"]);
});

test("문화생활: 영화·드라마·TV·음악·책. 디저트는 좋아하는 음식, 동물은 좋아하는 것들", () => {
  const c = sanitizeSection("culture", { movieGenres: ["romance", "nope"], movie: " 어바웃 타임 ", musicGenres: ["indie"], book: "소년이 온다", idol: "아이유" });
  assert.deepEqual(c, { movieGenres: ["romance"], movie: "어바웃 타임", drama: "", shows: "", musicGenres: ["indie"], song: "", book: "소년이 온다" });
  assert.equal(isEmptySection("culture", sanitizeSection("culture", {})), true);
  assert.equal((sanitizeSection("favorites", { movie: "x", musicGenres: ["indie"] }) as unknown as Record<string, unknown>).movie, undefined);
  assert.equal(sanitizeSection("favorites", { animal: " 고양이 " }).animal, "고양이");
  assert.equal(sanitizeSection("taste", { dessert: " 마카롱 " }).dessert, "마카롱");
  assert.equal(isEmptySection("taste", sanitizeSection("taste", { dessert: "마카롱" })), false);
  // 음악·영화 질문 답은 문화생활 칸에
  assert.deepEqual(applyAnswer({}, "musicGenre", "kpop").culture?.musicGenres, ["kpop"]);
  assert.equal(isAnswered({ culture: c }, "movieGenre"), true);
});

test("없음: 고르는 칸은 '없음'만 남기거나 다른 것만, 오늘의 질문 첫 칸도 없음", () => {
  assert.deepEqual(sanitizeSection("safety", { allergens: [NONE] }).allergens, [NONE]);
  assert.deepEqual(sanitizeSection("safety", { allergens: [NONE, "shrimp"] }).allergens, ["shrimp"], "다른 것과 섞이면 다른 것이 이긴다");
  assert.equal(isEmptySection("safety", sanitizeSection("safety", { allergens: [NONE] })), false, "없음도 답한 것");
  assert.deepEqual(sanitizeSection("life", { seasons: [NONE] }).seasons, [NONE]);
  assert.deepEqual(sanitizeSection("culture", { musicGenres: [NONE, "bogus"] }).musicGenres, [NONE]);
  const q = questionForPeople(TODAY, [{ contactId: "a", card: {} }])?.question;
  assert.ok(q && (q.options[0]?.value === NONE || q.id === "giftCard" || q.id === "spicy"));
  assert.deepEqual(applyAnswer({ culture: sanitizeSection("culture", { musicGenres: ["indie"] }) }, "musicGenre", NONE).culture?.musicGenres, [NONE]);
  assert.deepEqual(applyAnswer({ life: sanitizeSection("life", { seasons: [NONE] }) }, "season", "autumn").life?.seasons, ["autumn"]);
  assert.equal(applyAnswer({}, "drinks", NONE, "en").taste?.drinks, "None");
  // 메뉴 고르기에는 '없음'을 모으지 않는다
  const brief = mealBrief([{ key: "dad", name: "아빠", card: { safety: sanitizeSection("safety", { allergens: [NONE] }) }, sections: ["safety"] }]);
  assert.deepEqual(brief.allergens, []);
});

test("같이 고르기: 목록에 없는 안 먹는 것·알레르기도 메뉴 이름으로 거른다", () => {
  const dad = { key: "dad", name: "아빠", card: { safety: sanitizeSection("safety", { dislikes: ["삼겹살"], allergens: ["돈가스"] }) }, sections: ["safety"] as const };
  const v = judgeMenus([dad]);
  const pork = v.find((x) => x.item.code === "pork_bbq")!;
  assert.equal(pork.status, "soft");
  assert.deepEqual(pork.reasons.map((r) => r.code), ["삼겹살"]);
  assert.equal(v.find((x) => x.item.code === "tonkatsu")!.status, "avoid");
  assert.equal(v.find((x) => x.item.code === "sushi")!.status, "ok");
});

test("반려동물: 마리마다 이름·종류·품종·간식·메모, 빈 마리는 버리고, 없음은 키우는 동물이 없을 때만", () => {
  const p = sanitizeSection("pets", {
    pets: [
      { name: " 콩이 ", kind: "dog", breed: "말티즈", treats: "닭가슴살 육포, 삑삑이 공, 닭가슴살 육포", note: "7살" },
      { name: "", kind: "lion", breed: "", treats: [], note: "" },
      { name: "나비", kind: "cat", treats: ["츄르"] },
    ],
    none: true,
  });
  assert.deepEqual(p.pets.map((x) => [x.name, x.kind, x.breed, x.treats, x.note]), [
    ["콩이", "dog", "말티즈", ["닭가슴살 육포", "삑삑이 공"], "7살"],
    ["나비", "cat", "", ["츄르"], ""],
  ]);
  assert.equal(p.none, false, "키우는 동물이 있으면 없음이 아니다");
  assert.deepEqual(sanitizeSection("pets", { pets: [], none: true }), { pets: [], none: true });
  assert.equal(isEmptySection("pets", sanitizeSection("pets", { none: true })), false, "없음도 답한 것");
  assert.equal(isEmptySection("pets", sanitizeSection("pets", {})), true);
  assert.equal(sanitizeSection("pets", { pets: Array.from({ length: 15 }, (_, i) => ({ name: `${i}` })) }).pets.length, 10);
});
