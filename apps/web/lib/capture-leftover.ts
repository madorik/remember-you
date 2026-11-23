// AI가 말(글)을 항목으로 나눈 뒤에도 어느 항목에도 안 들어간 말이 있나 살핀다. 서버(나누기)가 쓰는 순수 함수라 서버 전용 모듈을 들이지 않는다.
// 조심스럽게만 찾는다: 알레르기·못 먹는 것처럼 놓치면 곤란한 말(안전)만 본다. 말을 절·문장 단위로 쪼개 안전한 말이 든 절을 찾고,
// 그 절의 낱말이 어느 줄(안전 칸이든 메모든)에도 안 보이고 안전 칸 줄도 모자랄 때만 '적지 못한 말'로 돌려준다.

/** 알레르기·못 먹는 것·식이 제한을 말하는 낱말(한국어·영어) */
const SAFETY = new RegExp(
  [
    "알레르기",
    "알러지",
    "알레르",
    "allerg",
    "못\\s*(?:먹|드시|드세|드십|마시|마셔)",
    "안\\s*(?:먹|드시|드세|드십|마시|마셔)",
    "(?:먹|마시|드시)지\\s*(?:못|않|말)",
    "(?:먹|마실|드실)\\s*수\\s*없",
    "금식",
    "비건",
    "채식",
    "vegan",
    "vegetarian",
    "intoleran",
    "(?:can't|cannot|can not|won't|doesn't|don't|does not|do not)\\s+(?:eat|drink|have)",
    "avoids?\\b",
  ].join("|"),
  "i",
);

/** 절을 가르는 곳: 문장 부호·줄바꿈, 이어 주는 말(~고·~며·~는데·~지만 뒤의 띄어쓰기), 그리고·and */
const CLAUSE_BREAK = /[\n.!?。,;·]+|(?<=[고며데만])\s+|\s+(?:그리고|그런데|근데|그래서|and|but)\s+/i;

/** 비교용 글: 소문자로, 한글·영문·숫자만 남긴다 */
const squash = (s: string) => s.toLowerCase().replace(/[^가-힣a-z0-9]+/g, "");

/** 한 줄이 가진 낱말(두 글자 이상): 보이는 값과 AI가 읽은 글·이름표 */
function wordsOf(line: LeftoverLine): string[] {
  return [line.value, line.item.text ?? "", line.item.label ?? ""]
    .flatMap((s) => s.toLowerCase().split(/[^가-힣a-z0-9]+/))
    .filter((w) => w.length >= 2);
}

export interface LeftoverLine {
  /** 화면에 보이는 값(describeCapture) */
  value: string;
  item: { target: string; text?: string | null; label?: string | null };
}

/** 위쪽 한도: 한 번에 알려 줄 말 수, 한 말의 길이 */
export const LEFTOVER_MAX = 3;
const LEFTOVER_CLIP = 60;

/**
 * 말(글) 안의 안전한 말(알레르기·못 먹는 것) 중 어느 줄에도 안 들어간 절을 돌려준다(없으면 빈 목록).
 * - 안전한 말이 든 절마다, 줄들의 낱말 중 하나라도 그 절에 있으면 '적힌 것'으로 본다
 * - 그래도 못 찾은 절은, 안전 칸 줄 수가 안전한 말이 든 절 수 이상이면 AI가 다르게 적었을 뿐이라 보고 넘어간다(오탐을 줄인다)
 */
export function findLeftovers(input: string, lines: readonly LeftoverLine[]): string[] {
  const clauses = input
    .split(CLAUSE_BREAK)
    .map((c) => c.trim())
    .filter((c) => c.length >= 2 && SAFETY.test(c));
  if (!clauses.length) return [];
  const words = lines.flatMap(wordsOf);
  const missing = clauses.filter((c) => {
    const key = squash(c);
    return !words.some((w) => key.includes(squash(w)));
  });
  if (!missing.length) return [];
  const safetyLines = lines.filter((l) => l.item.target.startsWith("safety.")).length;
  if (safetyLines >= clauses.length) return [];
  // 모자란 만큼만(안전 칸 줄이 일부 있으면 그만큼은 이 절들 중 하나로 적힌 것)
  return missing.slice(0, Math.max(1, clauses.length - safetyLines)).slice(0, LEFTOVER_MAX).map((c) => (c.length > LEFTOVER_CLIP ? `${c.slice(0, LEFTOVER_CLIP - 1)}…` : c));
}
