import "server-only";
import { addDays, sanitizeAvatar, sanitizeSection, solarToLunar, type AvatarConfig, type DateSpec, type Locale, type PartialCard, type YMD } from "@readme/core";
import { aad, seal } from "./crypto";
import { ensureBuiltinFolders, sealContactSections, writeSection, type BuiltinGroup } from "./data";
import { asSystem, asUser } from "./db";

// 데모 계정에 넣는 샘플: 테스터·스토어 심사자가 로그인 없이 바로 눌러 볼 수 있게.
// 날짜는 오늘 기준으로 계산해서(음력 생신 7일 전 등) 언제 열어도 홈에 "다가오는 날"이 보인다.

function lunarSpec(day: YMD): DateSpec {
  const l = solarToLunar(day);
  return l ? { calendar: "lunar", month: l.m, day: l.d, leap: l.leap } : { calendar: "solar", month: day.m, day: day.d };
}

function solarSpec(day: YMD): DateSpec {
  return { calendar: "solar", month: day.m, day: day.d };
}

/** 그 날(day)에 만 n세(또는 n주년)가 되도록 연도를 붙인다. 음력이면 음력 연도 */
function turning(spec: DateSpec, day: YMD, n: number): DateSpec {
  const year = spec.calendar === "lunar" ? (solarToLunar(day)?.y ?? day.y) : day.y;
  return { ...spec, year: year - n };
}

interface Sample {
  nickname: string;
  /** 내가 꾸며 둔 얼굴 */
  avatar?: Partial<AvatarConfig>;
  card: PartialCard;
  note?: { label: string; body: string };
  /** 내가 직접 적기만 한 사람(물어본 적 없음). 아니면 물어봐서 받은 답으로 채워진 기록 */
  mine?: boolean;
  /** 넣어 둘 기본 폴더(여러 개) */
  folders?: BuiltinGroup[];
}

function samples(locale: Locale, today: YMD): { me: { name: string; card: PartialCard }; people: Sample[] } {
  const ko = locale === "ko";
  return {
    me: {
      name: ko ? "데모" : "Demo",
      card: {
        safety: sanitizeSection("safety", { allergens: ["peach"], dislikes: ["cucumber"] }),
        taste: sanitizeSection("taste", { likes: ko ? ["떡볶이", "파스타"] : ["Tacos", "Pasta"], spicy: 2, drinks: ko ? "라떼" : "Latte" }),
        dates: sanitizeSection("dates", { birthday: turning(solarSpec(addDays(today, 64)), addDays(today, 64), 35) }),
        favorites: sanitizeSection("favorites", { colors: ["green", "white"] }),
        culture: sanitizeSection("culture", { musicGenres: ["indie"], movie: ko ? "어바웃 타임" : "About Time" }),
        life: sanitizeSection("life", { seasons: ["autumn"] }),
      },
    },
    people: [
      {
        nickname: ko ? "엄마" : "Mom",
        folders: ["family"],
        avatar: { hair: "perm", face: "round", body: "cardigan", item: "earrings", bg: "rose", cloth: "#E7D3B0", hairColor: "#5A4334", skin: "#FFF1E6" },
        card: {
          // 올해 음력 생신에 만 70세: 홈에 "엄마 칠순"
          dates: sanitizeSection("dates", { birthday: turning(lunarSpec(addDays(today, 7)), addDays(today, 7), 70) }),
          safety: sanitizeSection("safety", { dislikes: ["raw"] }),
          taste: sanitizeSection("taste", { spicy: 1, alcohol: { level: "little", kinds: ["makgeolli"] } }),
          favorites: sanitizeSection("favorites", {
            flowers: ko ? "카네이션보다 수국" : "Hydrangeas over roses",
            metals: ["gold"],
            vibes: ["quiet", "nature"],
            places: ko ? ["수목원", "온천"] : ["Arboretums", "Hot springs"],
          }),
          culture: sanitizeSection("culture", { musicGenres: ["trot"], shows: ko ? "인간극장" : "Antiques Roadshow" }),
          life: sanitizeSection("life", { hobbies: ko ? ["걷기", "트로트"] : ["Walking", "Gardening"], seasons: ["autumn"] }),
          pets: sanitizeSection("pets", { pets: [{ name: ko ? "콩이" : "Coco", kind: "dog", breed: ko ? "말티즈" : "Maltese", treats: ko ? ["닭가슴살 육포"] : ["Chicken jerky"], note: ko ? "7살, 산책을 좋아해요" : "7 years old, loves walks" }] }),
          sizes: sanitizeSection("sizes", { shoe: 240 }),
          gifts: sanitizeSection("gifts", {
            giftCard: "yes",
            wishlist: [{ title: ko ? "안마 쿠션" : "Massage cushion", url: "" }],
            skip: ko ? ["스카프"] : ["Scarves"],
          }),
        },
        note: { label: ko ? "작년 생신" : "Last bday", body: ko ? "홍삼 세트 드렸음" : "Gave a tea set" },
      },
      {
        nickname: ko ? "아내" : "Wife",
        folders: ["family"],
        avatar: { hair: "wave", face: "vline", body: "turtle", item: "necklace", bg: "sky", cloth: "#FF9DB0", hairColor: "#1F2340" },
        card: {
          dates: sanitizeSection("dates", {
            birthday: turning(solarSpec(addDays(today, 20)), addDays(today, 20), 33),
            anniversaries: [{ label: ko ? "결혼기념일" : "Wedding anniversary", spec: turning(solarSpec(addDays(today, 120)), addDays(today, 120), 6) }],
          }),
          safety: sanitizeSection("safety", { allergens: ["shrimp", "crab"], allergyNote: ko ? "국물에 들어간 것도 안 돼요. 해물탕집은 피해 주세요." : "Not even in broth. Please skip seafood stew places.", dislikes: ["cilantro"] }),
          taste: sanitizeSection("taste", {
            dessert: ko ? "바스크 치즈케이크" : "Basque cheesecake",
            likes: ko ? ["마라탕", "연어 초밥", "크림 파스타"] : ["Mala hot pot", "Salmon sushi", "Cream pasta"],
            spicy: 3,
            drinks: ko ? "아메리카노" : "Americano",
            alcohol: { level: "some", kinds: ["wine", "highball"] },
          }),
          sizes: sanitizeSection("sizes", { top: "55", bottom: "26", shoe: 235, ring: 11 }),
          gifts: sanitizeSection("gifts", {
            giftCard: "yes",
            wishlist: [{ title: ko ? "캠핑용 접이식 의자" : "Folding camp chair", url: "" }, { title: ko ? "원데이 도자기 클래스" : "One-day pottery class", url: "" }],
            skip: ko ? ["텀블러", "머그컵", "향초"] : ["Tumblers", "Mugs", "Candles"],
            brands: ko ? ["이솝", "무인양품"] : ["Aesop", "Muji"],
          }),
          favorites: sanitizeSection("favorites", { scent: ko ? "우디, 너무 달지 않은 향" : "Woody, not too sweet", flowers: ko ? "튤립" : "Tulips", vibes: ["cozy", "chic"],
            colors: ["sage", "cream", "burgundy"],
            patterns: ["stripe", "solid"],
            styles: ["minimal"],
            metals: ["silver"],
            idol: ko ? "아이유" : "IU",
            character: ko ? "망그러진 곰" : "Snoopy",
            animal: ko ? "고양이" : "Cats",
          }),
          culture: sanitizeSection("culture", {
            movieGenres: ["romance", "animation"],
            drama: ko ? "나의 아저씨" : "My Mister",
            musicGenres: ["ballad", "indie"],
            song: ko ? "밤편지" : "Through the Night",
          }),
          life: sanitizeSection("life", {
            seasons: ["spring"],
            travel: ko ? "교토" : "Kyoto",
          }),
        },
        note: { label: ko ? "10월 2일" : "Oct 2", body: ko ? "소품샵에서 라탄 바구니 예쁘다고 함" : "Liked a rattan basket at a gift shop" },
      },
      {
        nickname: ko ? "아빠" : "Dad",
        folders: ["family"],
        avatar: { hair: "side", face: "square", body: "suit", item: "mustache", glasses: "square", bg: "ocean", cloth: "#1F2340", hairColor: "#A3A8BC", skin: "#F8DCC3" },
        mine: true,
        card: {
          dates: sanitizeSection("dates", { birthday: turning(lunarSpec(addDays(today, 28)), addDays(today, 28), 72) }),
          safety: sanitizeSection("safety", { dislikes: ["offal"] }),
          taste: sanitizeSection("taste", { spicy: 2, alcohol: { level: "lots", kinds: ["soju", "makgeolli"] } }),
          life: sanitizeSection("life", { hobbies: ko ? ["등산", "막걸리"] : ["Hiking", "Craft beer"] }),
          sizes: sanitizeSection("sizes", { top: "100", shoe: 265 }),
        },
      },
      {
        nickname: ko ? "단짝" : "Bestie",
        folders: ["friends"],
        avatar: { hair: "pony", face: "oval", body: "zip", item: "cap", bg: "water", cloth: "#34B36A", hairColor: "#D9A15B" },
        card: {
          dates: sanitizeSection("dates", { birthday: turning(solarSpec(addDays(today, 93)), addDays(today, 93), 34) }),
          safety: sanitizeSection("safety", { allergens: ["peanut"] }),
          taste: sanitizeSection("taste", { likes: ko ? ["곱창", "평양냉면"] : ["BBQ", "Cold noodles"], spicy: 4, alcohol: { level: "lots", kinds: ["beer"] } }),
          favorites: sanitizeSection("favorites", { team: ko ? "LG 트윈스" : "LA Dodgers" }),
          culture: sanitizeSection("culture", { movieGenres: ["action", "sf"], musicGenres: ["hiphop"] }),
        },
      },
    ],
  };
}

/** 데모 계정 채우기(한 번만). 사람마다 내 기록 하나. 물어봐서 받은 사람은 며칠 전에 답한 것으로 */
export async function seedDemo(uid: string, locale: Locale, today: YMD): Promise<void> {
  const data = samples(locale, today);
  const done = await asSystem(async (q) => {
    const row = await q.one<{ is_demo: boolean }>("select is_demo from profiles where id = $1 for update", [uid]);
    if (!row || row.is_demo) return true;
    await q(
      `update profiles set is_demo = true, display_name = $2, avatar = $3, onboarded_at = coalesce(onboarded_at, now()), system_locale = $4 where id = $1`,
      [uid, data.me.name, JSON.stringify({ hair: "bob", body: "shirt", item: "pencil", glasses: "round", bg: "sky", cloth: "#FFFFFF", hairColor: "#1F2340" }), locale],
    );
    await ensureBuiltinFolders(q, uid);
    // 한 트랜잭션이라 now()가 같다. 넣은 순서대로 보이게 사람마다 실제 시각을 찍는다
    for (const [i, p] of data.people.entries()) {
      const c = await q.one<{ id: string }>(`insert into contacts (user_id, nickname, avatar, created_at) values ($1, $2, $3, clock_timestamp()) returning id`, [
        uid,
        p.nickname,
        p.avatar ? JSON.stringify(sanitizeAvatar(p.avatar)) : null,
      ]);
      if (p.folders?.length) {
        await q(
          "insert into contact_group_members (group_id, contact_id, user_id) select g.id, $2, $1 from contact_groups g where g.user_id = $1 and g.builtin = any($3::text[])",
          [uid, c!.id, p.folders],
        );
      }
      const answeredAt = new Date(Date.now() - (i + 2) * 86_400_000).toISOString();
      const answered = p.mine ? {} : Object.fromEntries(Object.keys(p.card).map((k) => [k, answeredAt]));
      await q(`insert into contact_cards (contact_id, author_id, sections, answered) values ($1, $2, $3, $4)`, [
        c!.id,
        uid,
        JSON.stringify(sealContactSections(uid, c!.id, p.card)),
        JSON.stringify(answered),
      ]);
      if (p.note) {
        await q(`insert into notes (author_id, contact_id, label, payload) values ($1, $2, $3, $4)`, [
          uid,
          c!.id,
          p.note.label,
          JSON.stringify(seal({ body: p.note.body }, aad.note(uid, c!.id))),
        ]);
      }
    }
    return false;
  });
  if (done) return;
  await asUser(uid, async (q) => {
    for (const [section, value] of Object.entries(data.me.card)) await writeSection(q, uid, section as keyof PartialCard, value);
  });
}
