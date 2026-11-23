import "server-only";
import { INVITE_TTL_DAYS, INVITE_TTL_FALLBACK_DAYS, hashToken, randomCode, randomToken } from "@readme/core";
import type { Q } from "./db";

// 0033 마이그레이션(질문 열·30일 제약)이 아직 적용되지 않은 DB에서도 링크를 만들 수 있게, 안 되면 물러나 만든다.
// 물러난 뒤 5분 동안은 처음부터 물러난 모양으로 만들고(실패한 문장을 또 보내지 않는다), 그 뒤 다시 새 모양부터 시도한다
const RETRY_NEW_AFTER_MS = 5 * 60_000;
const fellBack = { questions: 0, ttl: 0 };
const recently = (t: number) => Date.now() - t < RETRY_NEW_AFTER_MS;

/**
 * 물어보기 링크 한 줄을 만든다(로그인한 사람 권한으로, 내 주소록 사람에게만). 토큰은 해시만 저장하고 원문은 링크로만 나간다.
 * 해시·코드가 겹치면(아주 드물다) 그 시도만 되돌리고(savepoint) 다시 만든다. prefill은 토큰 해시를 알아야 암호화할 수 있어서 함수로 받는다.
 * 링크는 INVITE_TTL_DAYS(30일)로 만든다. DB 제약이 아직 8일이면 7일로, questions 열이 아직 없으면 그 열 없이(질문이 속한 항목 전체를 묻는 방식으로) 만든다.
 */
export async function insertInvite(
  q: Q,
  row: { inviter_id: string; contact_id: string; sections: string[]; questions?: string[]; recipient_name?: string; message?: string },
  prefill?: (tokenHash: string) => unknown,
): Promise<{ id: string; token: string; hash: string; code: string }> {
  let days = recently(fellBack.ttl) ? INVITE_TTL_FALLBACK_DAYS : INVITE_TTL_DAYS;
  let withQuestions = !!row.questions?.length && !recently(fellBack.questions);
  for (let attempt = 0; attempt < 8; attempt++) {
    const token = randomToken();
    const hash = await hashToken(token);
    const code = randomCode();
    await q("savepoint invite_try");
    try {
      const values = [row.inviter_id, row.contact_id, row.sections, row.recipient_name ?? "", row.message ?? "", JSON.stringify(prefill ? prefill(hash) : {}), hash, code, days];
      const inserted = withQuestions
        ? await q.one<{ id: string }>(
            `insert into invites (inviter_id, contact_id, sections, recipient_name, message, prefill, token_hash, code, expires_at, questions)
             values ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(days => $9), $10)
             returning id`,
            [...values, row.questions],
          )
        : await q.one<{ id: string }>(
            `insert into invites (inviter_id, contact_id, sections, recipient_name, message, prefill, token_hash, code, expires_at)
             values ($1, $2, $3, $4, $5, $6, $7, $8, now() + make_interval(days => $9))
             returning id`,
            values,
          );
      await q("release savepoint invite_try");
      if (inserted) return { id: inserted.id, token, hash, code };
    } catch (e) {
      await q("rollback to savepoint invite_try");
      const sqlState = (e as { code?: string }).code;
      if (sqlState === "23505") continue;
      // questions 열이 아직 없다(42703): 질문 없이 항목 전체로
      if (sqlState === "42703" && withQuestions) {
        withQuestions = false;
        fellBack.questions = Date.now();
        continue;
      }
      // 기간 제약이 아직 8일(23514): 7일로
      if (sqlState === "23514" && days > INVITE_TTL_FALLBACK_DAYS) {
        days = INVITE_TTL_FALLBACK_DAYS;
        fellBack.ttl = Date.now();
        continue;
      }
      throw e;
    }
  }
  throw new Error("could not create invite");
}
