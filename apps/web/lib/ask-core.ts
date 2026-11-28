import { isEmptySection, type DatesData, type GiftsData, type PartialCard, type Section, type WishItem } from "@readme/core";

// 물어보기에서 서버 전용 모듈 없이 시험할 수 있는 순수 함수

/**
 * 상대 화면에 미리 채워 보여 줄 값에서 '내가 해주고 싶은 선물'(gifts.wishlist)을 뺀다.
 * 내 기록의 wishlist는 내가 나중에 사 줄 선물이라 상대에게 보이면 깜짝 선물이 새고, 상대 화면에서는 '받고 싶은 것'으로 잘못 읽힌다.
 * 선물 칸에서 상대가 맞는지 확인할 수 있는 건 상품권·피하고 싶은 것·좋아하는 브랜드뿐. 그것도 없으면 칸을 통째로 뺀다(빈 칸을 '맞아요?'로 묻지 않게)
 */
export function prefillForRecipient(card: PartialCard): PartialCard {
  const rest = withoutPlans(card);
  const g = rest.gifts;
  if (!g) return rest;
  const out = { ...rest };
  delete out.gifts;
  if (g.giftCard == null && !g.skip.length && !g.brands.length) return out;
  return { ...out, gifts: { ...g, wishlist: [] } };
}

/**
 * 한 번만 있는 날(약속·집들이 …)은 상대에게 보이지 않게 뺀다: 상대에게 말 안 한 약속(깜짝 파티 같은)이 새면 안 된다. 생일·해마다 도는 기념일만 남기고, 그것도 없으면 칸째 뺀다
 */
function withoutPlans(card: PartialCard): PartialCard {
  const d = card.dates;
  if (!d?.anniversaries.some((a) => a.once)) return card;
  const rest = { ...card };
  const dates = { ...d, anniversaries: d.anniversaries.filter((a) => !a.once) };
  if (isEmptySection("dates", dates)) delete rest.dates;
  else rest.dates = dates;
  return rest;
}

/**
 * 상대가 생일·기념일 칸에 답하면 칸 전체가 새 값으로 바뀌는데, 상대는 내 한 번만 있는 날(약속)을 보지 못했으니(prefillForRecipient) 그냥 두면 사라진다.
 * 내가 적어 둔 약속은 그대로 두고, 상대가 적은 기념일에서는 한 번만 있는 날을 받지 않는다(약속은 내 메모로만 생긴다)
 */
export function keepAskerPlans(answer: DatesData, existing: DatesData | null | undefined): DatesData {
  const plans = (existing?.anniversaries ?? []).filter((a) => a.once);
  if (!plans.length && !answer.anniversaries.some((a) => a.once)) return answer;
  return { ...answer, anniversaries: [...answer.anniversaries.filter((a) => !a.once), ...plans] };
}

const wishKey = (w: WishItem) => `${w.title}\n${w.url}`;

/**
 * 상대가 선물 칸에 답하면 칸 전체가 새 값으로 바뀌는데, 상대는 내 wishlist를 보지 못했으니(prefillForRecipient) 그냥 두면 내가 적어 둔 선물이 사라진다.
 * 내가 적어 둔 것을 앞에 그대로 두고, 상대가 적은 것을 뒤에 더한다(같은 것은 한 번만). 개수 제한은 sanitizeSection이 다시 건다
 */
export function keepAskerWishes(answer: GiftsData, existing: GiftsData | null | undefined): GiftsData {
  if (!existing?.wishlist.length) return answer;
  const seen = new Set<string>();
  const wishlist: WishItem[] = [];
  for (const w of [...existing.wishlist, ...answer.wishlist]) {
    const k = wishKey(w);
    if (seen.has(k)) continue;
    seen.add(k);
    wishlist.push(w);
  }
  return { ...answer, wishlist };
}

/**
 * 답에서 값이 있는 항목만 남긴다. 값이 하나도 없는 항목(화면에서 건드리지 않고 '다음'만 누른 것)은 저장하지 않는다:
 * 저장하면 물어본 사람 기록의 그 항목이 빈 값으로 덮이고 '답했다'는 표시와 알림만 남아, 열어 보면 아무것도 없다.
 * 사람이 '없어요'를 눌러 직접 비운 항목(none)은 그 뜻이라 남긴다
 */
export function keepAnswered(answer: PartialCard, none: readonly string[] = []): PartialCard {
  const out: PartialCard = {};
  for (const [section, value] of Object.entries(answer)) {
    if (!isEmptySection(section as Section, value as never) || none.includes(section)) (out as Record<string, unknown>)[section] = value;
  }
  return out;
}
