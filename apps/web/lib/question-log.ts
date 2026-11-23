import "server-only";
import { cookies } from "next/headers";
import type { QuestionLogEntry } from "./question-topic";

// 오늘의 질문을 어떻게 처리했는지 오늘 하루만 이 기기에 적어 둔다(홈의 '2개 다 했어요' 체크 목록용).
// 처리한 횟수 자체는 DB(profiles.question_count)가 세고, 이건 그 목록의 내용(누구·무슨 질문·답)만 쿠키에 둔 것이라 다른 기기·지워진 뒤엔 비어 있을 수 있다(그땐 횟수만 보인다).
// 오래 두지 않는다: 날짜가 바뀌면 버리고, 최근 네 개까지만.

const NAME = "rm_qlog";
const MAX = 4;

function parse(raw: string | undefined, day: string): QuestionLogEntry[] {
  if (!raw) return [];
  try {
    const j = JSON.parse(raw) as { d?: unknown; e?: unknown };
    if (j.d !== day || !Array.isArray(j.e)) return [];
    return j.e
      .filter((x): x is QuestionLogEntry => !!x && typeof x === "object" && typeof (x as QuestionLogEntry).c === "string" && typeof (x as QuestionLogEntry).q === "string" && ["a", "w", "k", "m"].includes((x as QuestionLogEntry).o))
      .slice(-MAX);
  } catch {
    return [];
  }
}

/** 오늘(day = YYYY-MM-DD) 처리한 질문들 */
export async function readQuestionLog(day: string): Promise<QuestionLogEntry[]> {
  return parse((await cookies()).get(NAME)?.value, day);
}

/** 오늘 처리한 질문 하나를 더한다(서버 동작 안에서) */
export async function addQuestionLog(day: string, entry: QuestionLogEntry): Promise<void> {
  const jar = await cookies();
  const list = [...parse(jar.get(NAME)?.value, day), { ...entry, ...(entry.v ? { v: entry.v.slice(0, 24) } : {}) }].slice(-MAX);
  jar.set(NAME, JSON.stringify({ d: day, e: list }), { path: "/", maxAge: 60 * 60 * 36, sameSite: "lax", httpOnly: true, secure: process.env.NODE_ENV === "production" });
}
