// RLS·함수 권한 테스트. 로컬 도커 Postgres(pnpm db:start && pnpm db:migrate)에 붙어서 돈다: pnpm test:db
// 앱 서버와 똑같이 트랜잭션 안에서 app_user 역할 + app.user_id로 바꿔서 쿼리한다(apps/web/lib/db.ts).
import { createHash, randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import pg from "pg";

const URL = process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:55433/readme";
const pool = new pg.Pool({ connectionString: URL, max: 4 });
const made: string[] = [];

type Client = pg.PoolClient;

async function as<T>(uid: string | null, fn: (c: Client) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("set local role app_user");
    await c.query("select set_config('app.user_id', $1, true)", [uid ?? ""]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

async function rows(uid: string | null, sql: string, params: unknown[] = []) {
  return as(uid, async (c) => (await c.query(sql, params)).rows);
}

async function makeUser(name: string, anonymous = false): Promise<string> {
  const id = randomUUID();
  await pool.query(`insert into "user" (id, name, email, "isAnonymous") values ($1, $2, $3, $4)`, [id, name, `${id}@test.invalid`, anonymous]);
  made.push(id);
  return id;
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function token() {
  const raw = randomBytes(24).toString("base64url");
  const code = Array.from(randomBytes(6), (b) => ALPHABET[b % ALPHABET.length]).join("");
  return { raw, hash: createHash("sha256").update(raw).digest("hex"), code };
}

async function writeCard(uid: string, section: string, payload: unknown) {
  await rows(uid, "insert into card_sections (owner_id, section, payload) values ($1, $2, $3) on conflict (owner_id, section) do update set payload = excluded.payload", [
    uid,
    section,
    JSON.stringify(payload),
  ]);
}

async function rejects(p: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(p, (e: Error) => pattern.test(e.message));
}

/** 내 주소록에 사람 하나 + 빈 기록(앱이 사람을 더할 때와 같다) */
async function person(uid: string, nickname: string): Promise<string> {
  const [c] = await rows(uid, "insert into contacts (user_id, nickname) values ($1, $2) returning id", [uid, nickname]);
  await rows(uid, "insert into contact_cards (contact_id, author_id) values ($1, $2)", [c.id, uid]);
  return c.id;
}

/** 물어보기 링크(앱 역할로, 내 주소록 사람에게) */
async function ask(uid: string, contactId: string, sections: string[], recipient = "") {
  const t = token();
  await rows(
    uid,
    `insert into invites (inviter_id, contact_id, token_hash, code, sections, recipient_name, expires_at)
     values ($1, $2, $3, $4, $5, $6, now() + interval '7 days')`,
    [uid, contactId, t.hash, t.code, sections, recipient],
  );
  return t;
}

/** 시스템(소유자) 권한으로 답하기: 답하는 웹 화면과 같은 길 */
async function answer(hash: string, sections: Record<string, unknown>, consent = true, answerer: string | null = null) {
  return (await pool.query("select submit_request_answer($1, $2::jsonb, $3, $4) as id", [hash, JSON.stringify(sections), consent, answerer])).rows[0].id as string;
}

let alice: string, bob: string, carol: string;

before(async () => {
  alice = await makeUser("앨리스");
  bob = await makeUser("밥");
  carol = await makeUser("캐럴");
  await writeCard(alice, "safety", { sealed: "x" });
  await writeCard(alice, "taste", { likes: ["떡볶이"] });
  await writeCard(alice, "sizes", { sealed: "y" });
});

after(async () => {
  await pool.query(`delete from "user" where id = any ($1)`, [made]);
  await pool.end();
});

describe("로그인 표", () => {
  test("앱 역할은 user·session·account를 못 읽는다", async () => {
    for (const table of [`"user"`, "session", "account", "verification"]) {
      await rejects(rows(alice, `select * from ${table} limit 1`), /permission denied/);
    }
  });

  test("가입하면 프로필이 생기고, 데모 계정은 이름이 비어 있다", async () => {
    const demo = await makeUser("Anonymous", true);
    const [p] = await rows(demo, "select display_name, locale from profiles where id = $1", [demo]);
    assert.equal(p.display_name, "");
    assert.equal(p.locale, null);
    const [a] = await rows(alice, "select display_name from profiles where id = $1", [alice]);
    assert.equal(a.display_name, "앨리스");
  });
});

describe("내 리드미", () => {
  test("남의 리드미도 프로필도 못 본다", async () => {
    assert.equal((await rows(carol, "select * from card_sections where owner_id = $1", [alice])).length, 0);
    assert.equal((await rows(carol, "select * from profiles where id = $1", [alice])).length, 0);
    assert.equal((await rows(null, "select * from card_sections")).length, 0);
    assert.equal((await rows(alice, "select * from card_sections where owner_id = $1", [alice])).length, 3);
  });

  test("남의 리드미를 쓰거나 고칠 수 없다", async () => {
    await rejects(rows(carol, "insert into card_sections (owner_id, section, payload) values ($1, 'gifts', '{}')", [alice]), /row-level security/);
    const changed = await rows(carol, "update card_sections set payload = '{}' where owner_id = $1 returning 1", [alice]);
    assert.equal(changed.length, 0);
  });

  test("공유 허락·손님 카드는 더 없다", async () => {
    for (const table of ["grants", "guest_cards"]) await rejects(rows(alice, `select * from ${table}`), /does not exist/);
  });
});

describe("사람 기록", () => {
  test("내 주소록 칸에 내 이름으로만 기록을 만들고, 나만 보며, 칸을 지우면 같이 지워진다", async () => {
    const mom = await person(alice, "엄마");
    await rows(alice, "update contact_cards set sections = sections || jsonb_build_object('dates', '{\"v\":1,\"data\":{}}'::jsonb) where contact_id = $1", [mom]);
    const [mine] = await rows(alice, "select sections, answered from contact_cards where contact_id = $1", [mom]);
    assert.deepEqual(Object.keys(mine.sections), ["dates"]);
    assert.deepEqual(mine.answered, {});

    // 남은 못 보고, 못 고치고, 못 지운다
    assert.equal((await rows(bob, "select * from contact_cards where contact_id = $1", [mom])).length, 0);
    assert.equal((await rows(bob, "update contact_cards set sections = '{}' where contact_id = $1 returning 1", [mom])).length, 0);
    assert.equal((await rows(bob, "delete from contact_cards where contact_id = $1 returning 1", [mom])).length, 0);

    // 남의 주소록 칸에 붙이거나, 남의 이름으로 만들 수 없다
    const [bobs] = await rows(bob, "insert into contacts (user_id, nickname) values ($1, '삼촌') returning id", [bob]);
    await rejects(rows(alice, "insert into contact_cards (contact_id, author_id) values ($1, $2)", [bobs.id, alice]), /row-level security/);
    await rejects(rows(bob, "insert into contact_cards (contact_id, author_id) values ($1, $2)", [bobs.id, alice]), /row-level security/);
    await rejects(rows(alice, "insert into contact_cards (contact_id, author_id) values ($1, $2)", [mom, alice]), /duplicate key/);

    await rows(alice, "delete from contacts where id = $1", [mom]);
    assert.equal((await pool.query("select 1 from contact_cards where contact_id = $1", [mom])).rowCount, 0);
  });

  test("앱 역할로는 주소록 칸을 앱 사용자와 이을 수 없다(프로필 엿보기 방지)", async () => {
    await rejects(rows(carol, "insert into contacts (user_id, person_id) values ($1, $2)", [carol, bob]), /not connected/);
    const [c] = await rows(carol, "insert into contacts (user_id, nickname) values ($1, '밥') returning id", [carol]);
    await rejects(rows(carol, "update contacts set person_id = $2 where id = $1", [c.id, bob]), /not connected/);
    await rejects(rows(carol, "insert into contacts (user_id, nickname) values ($1, '엿보기')", [bob]), /row-level security/);
  });
});

describe("물어보기", () => {
  test("내 주소록 사람에게만, 안 쓴 상태로만 만들고, 남의 것은 안 보인다", async () => {
    const mine = await person(carol, "친구");
    const bobs = await person(bob, "동생");
    const t = token();
    await rejects(
      rows(carol, `insert into invites (inviter_id, contact_id, token_hash, code, sections, expires_at, used_at) values ($1, $2, $3, $4, array['taste'], now() + interval '1 day', now())`, [
        carol,
        mine,
        t.hash,
        t.code,
      ]),
      /must start unused/,
    );
    await rejects(
      rows(carol, `insert into invites (inviter_id, contact_id, token_hash, code, sections, expires_at) values ($1, $2, $3, $4, array['taste'], now() + interval '1 day')`, [carol, bobs, t.hash, t.code]),
      /row-level security/,
    );
    await rejects(
      rows(carol, `insert into invites (inviter_id, contact_id, token_hash, code, sections, expires_at) values ($1, $2, $3, $4, array['taste'], now() + interval '1 day')`, [bob, bobs, t.hash, t.code]),
      /row-level security/,
    );
    await ask(carol, mine, ["taste"]);
    assert.equal((await rows(bob, "select * from invites where inviter_id = $1", [carol])).length, 0);
    assert.equal((await rows(carol, "select * from invites where inviter_id = $1", [carol])).length, 1);
  });

  test("시스템 전용 함수는 앱 역할로 못 부른다", async () => {
    const c = await person(alice, "누군가");
    const t = await ask(alice, c, ["taste"]);
    await rejects(rows(carol, "select * from find_invite($1, null)", [t.hash]), /permission denied/);
    await rejects(rows(carol, "select * from request_for_answer($1)", [t.hash]), /permission denied/);
    await rejects(rows(carol, "select submit_request_answer($1, '{}'::jsonb, false, null)", [t.hash]), /permission denied/);
  });

  test("답하면 물어본 항목만 물어본 사람의 기록에 들어가고, 답한 때와 알림이 남고, 남은 못 본다", async () => {
    const mom = await person(alice, "엄마");
    await rows(alice, "update contact_cards set sections = jsonb_build_object('taste', '{\"v\":1,\"data\":\"내가 적은 것\"}'::jsonb) where contact_id = $1", [mom]);
    const t = await ask(alice, mom, ["safety", "dates"], "엄마");
    const [r] = (await pool.query("select * from request_for_answer($1)", [t.hash])).rows;
    assert.equal(r.state, "active");
    assert.equal(r.inviter_id, alice);
    assert.equal(r.contact_id, mom);

    // 알레르기는 동의가 있어야 한다
    await rejects(answer(t.hash, { safety: { sealed: "a" } }, false), /consent_required/);
    // 물어보지 않은 항목(sizes)은 들어가지 않는다
    const contact = await answer(t.hash, { safety: { sealed: "a" }, dates: { sealed: "b" }, sizes: { sealed: "c" } });
    assert.equal(contact, mom);
    await rejects(answer(t.hash, { dates: { sealed: "x" } }), /used/);

    const [rec] = await rows(alice, "select sections, answered from contact_cards where contact_id = $1", [mom]);
    assert.deepEqual(Object.keys(rec.sections).sort(), ["dates", "safety", "taste"]);
    assert.deepEqual(rec.sections.safety, { sealed: "a" });
    assert.deepEqual(Object.keys(rec.answered).sort(), ["dates", "safety"]);
    const [n] = await rows(alice, "select kind, contact_id, label from notifications where user_id = $1 and kind = 'answered'", [alice]);
    assert.equal(n.contact_id, mom);
    assert.equal(n.label, "엄마");
    assert.equal((await rows(bob, "select * from contact_cards where contact_id = $1", [mom])).length, 0);
  });

  test("로그인하고 답하면 그 사람과 이어져 얼굴·이름만 보이고, 내 링크에는 못 답한다", async () => {
    const dan = await makeUser("댄");
    const c = await person(alice, "댄 선배");
    const t = await ask(alice, c, ["taste"]);
    await rejects(answer(t.hash, { taste: { v: 1, data: {} } }, true, alice), /self/);
    await answer(t.hash, { taste: { v: 1, data: {} } }, true, dan);
    const [linked] = await rows(alice, "select person_id from contacts where id = $1", [c]);
    assert.equal(linked.person_id, dan);
    assert.equal((await rows(alice, "select display_name from profiles where id = $1", [dan]))[0].display_name, "댄");
    assert.equal((await rows(alice, "select * from card_sections where owner_id = $1", [dan])).length, 0);
    // 이미 다른 칸에 이어진 사람이면 새 칸은 잇지 않는다
    const again = await person(alice, "댄 또");
    const t2 = await ask(alice, again, ["taste"]);
    await answer(t2.hash, { taste: { v: 1, data: {} } }, true, dan);
    assert.equal((await rows(alice, "select person_id from contacts where id = $1", [again]))[0].person_id, null);
  });

  test("지난 링크·취소한 링크에는 못 답하고, 남의 링크는 취소 못 하며, 사람을 지우면 링크도 지워진다", async () => {
    const c = await person(alice, "이모");
    const old = token();
    await pool.query(
      `insert into invites (inviter_id, contact_id, token_hash, code, sections, created_at, expires_at) values ($1, $2, $3, $4, array['taste'], now() - interval '3 days', now() - interval '1 minute')`,
      [alice, c, old.hash, old.code],
    );
    await rejects(answer(old.hash, { taste: {} }), /expired/);

    const t = await ask(alice, c, ["taste"]);
    const id = (await pool.query("select id from invites where token_hash = $1", [t.hash])).rows[0].id;
    const [{ ok: notMine }] = await rows(bob, "select cancel_invite($1) as ok", [id]);
    assert.equal(notMine, false);
    const [{ ok }] = await rows(alice, "select cancel_invite($1) as ok", [id]);
    assert.equal(ok, true);
    await rejects(answer(t.hash, { taste: {} }), /canceled/);

    const t3 = await ask(alice, c, ["dates"]);
    await rows(alice, "delete from contacts where id = $1", [c]);
    assert.equal((await pool.query("select 1 from invites where token_hash = $1", [t3.hash])).rowCount, 0);
  });
});

describe("메모·알림·폴더·푸시", () => {
  test("메모는 내 주소록 칸에만, 나만 본다", async () => {
    const c = await person(bob, "앨리스");
    await rows(bob, "insert into notes (author_id, contact_id, label, payload) values ($1, $2, '선물', '{}')", [bob, c]);
    assert.equal((await rows(bob, "select * from notes where contact_id = $1", [c])).length, 1);
    assert.equal((await rows(alice, "select * from notes where contact_id = $1", [c])).length, 0);
    await rejects(rows(carol, "insert into notes (author_id, contact_id, payload) values ($1, $2, '{}')", [carol, c]), /row-level security/);
  });

  test("알림은 직접 만들 수 없다", async () => {
    await rejects(rows(carol, "insert into notifications (user_id, kind) values ($1, 'answered')", [alice]), /row-level security/);
  });

  test("폴더는 내 것만 보고, 남의 폴더·남의 사람은 못 넣고, 기본 폴더는 이름을 못 바꾸고 못 지우며, 한 사람이 여러 폴더에 들고, 폴더를 지워도 사람은 남는다", async () => {
    await rows(alice, "insert into contact_groups (user_id, builtin) values ($1, 'family') on conflict do nothing", [alice]);
    const [mine] = await rows(alice, "insert into contact_groups (user_id, name, icon, color) values ($1, '동창', 'plane', 'sky') returning id", [alice]);
    assert.equal((await rows(bob, "select id from contact_groups where id = $1", [mine.id])).length, 0);
    await rejects(rows(bob, "insert into contact_groups (user_id, name) values ($1, '엿보기')", [alice]), /row-level security/);
    await rejects(rows(alice, "update contact_groups set icon = 'rocket' where id = $1", [mine.id]), /check constraint/);

    const [bc] = await rows(bob, "insert into contacts (user_id, nickname) values ($1, '누군가') returning id", [bob]);
    const member = "insert into contact_group_members (group_id, contact_id, user_id) values ($1, $2, $3)";
    await rejects(rows(bob, member, [mine.id, bc.id, bob]), /not your folder/);
    await rejects(rows(alice, member, [mine.id, bc.id, alice]), /not your folder/);
    await rejects(rows(bob, member, [mine.id, bc.id, alice]), /not your folder|row-level security/);

    const [fam] = await rows(alice, "select id from contact_groups where user_id = $1 and builtin = 'family'", [alice]);
    await rejects(rows(alice, "delete from contact_groups where id = $1", [fam.id]), /builtin group/);
    await rejects(rows(alice, "update contact_groups set name = '우리집' where id = $1", [fam.id]), /builtin group/);
    await rows(alice, "update contact_groups set color = 'peach', icon = 'cake' where id = $1", [fam.id]);

    const [ac] = await rows(alice, "insert into contacts (user_id, nickname, favorite) values ($1, '친구', true) returning id", [alice]);
    await rows(alice, member, [mine.id, ac.id, alice]);
    await rows(alice, member, [fam.id, ac.id, alice]);
    assert.equal((await rows(alice, "select 1 from contact_group_members where contact_id = $1", [ac.id])).length, 2);
    assert.equal((await rows(bob, "select 1 from contact_group_members where contact_id = $1", [ac.id])).length, 0);
    await rows(alice, "delete from contact_groups where id = $1", [mine.id]);
    assert.equal((await rows(alice, "select 1 from contact_group_members where contact_id = $1", [ac.id])).length, 1);
    const [after] = await rows(alice, "select favorite from contacts where id = $1", [ac.id]);
    assert.equal(after.favorite, true);
  });

  test("선물 찾을 말은 내 주소록 사람에게만, 나만 보고, 사람을 지우면 같이 지워진다. 쿠팡 검색 저장·호출 기록은 앱 역할로 못 본다", async () => {
    const c = await person(alice, "아빠");
    const put = "insert into gift_ideas (user_id, contact_id, basis, payload) values ($1, $2, 'b', '{}')";
    await rows(alice, put, [alice, c]);
    assert.equal((await rows(alice, "select 1 from gift_ideas where contact_id = $1", [c])).length, 1);
    assert.equal((await rows(bob, "select 1 from gift_ideas where contact_id = $1", [c])).length, 0);
    await rejects(rows(bob, put, [bob, c]), /row-level security/);
    await rejects(rows(bob, put, [alice, c]), /row-level security/);
    await rows(alice, "delete from contacts where id = $1", [c]);
    assert.equal((await pool.query("select 1 from gift_ideas where contact_id = $1", [c])).rowCount, 0);
    await rejects(rows(alice, "select * from coupang_searches"), /permission denied/);
    await rejects(rows(alice, "insert into coupang_calls default values"), /permission denied/);
  });

  test("푸시 토큰은 내 것만", async () => {
    await rows(bob, "insert into push_tokens (user_id, token, platform) values ($1, 'tok-bob', 'android')", [bob]);
    assert.equal((await rows(carol, "select * from push_tokens where user_id = $1", [bob])).length, 0);
    await rejects(rows(carol, "insert into push_tokens (user_id, token, platform) values ($1, 'tok', 'ios')", [bob]), /row-level security/);
  });
});

describe("계정 삭제", () => {
  test("지우면 리드미·주소록·기록·물어보기가 함께 사라지고, 이어 둔 남의 주소록 칸은 이름만 남는다", async () => {
    const gone = await makeUser("지울 사람");
    await writeCard(gone, "taste", { likes: ["커피"] });
    const aunt = await person(gone, "이모");
    await ask(gone, aunt, ["taste"]);
    // 캐럴이 물어본 것에 로그인하고 답해서 캐럴 주소록에 이어져 있다
    const c = await person(carol, "지울 사람");
    const t = await ask(carol, c, ["taste"]);
    await answer(t.hash, { taste: { v: 1, data: {} } }, true, gone);

    await rejects(rows(carol, `delete from "user" where id = $1`, [gone]), /permission denied/);
    await rows(null, "select delete_my_account()").then(
      () => assert.fail("로그인 없이 지워지면 안 된다"),
      (e: Error) => assert.match(e.message, /not_signed_in/),
    );
    await rows(gone, "select delete_my_account()");
    assert.equal((await pool.query(`select 1 from "user" where id = $1`, [gone])).rowCount, 0);
    assert.equal((await pool.query("select 1 from card_sections where owner_id = $1", [gone])).rowCount, 0);
    assert.equal((await pool.query("select 1 from contact_cards where author_id = $1", [gone])).rowCount, 0);
    assert.equal((await pool.query("select 1 from invites where inviter_id = $1", [gone])).rowCount, 0);
    const [kept] = await rows(carol, "select person_id, nickname from contacts where id = $1", [c]);
    assert.equal(kept.person_id, null);
    assert.equal(kept.nickname, "지울 사람");
    assert.equal((await rows(carol, "select 1 from contact_cards where contact_id = $1", [c])).length, 1);
  });
});

describe("속도 제한(rate_hit)", () => {
  const hit = async (key: string, windowSec = 60, max = 3) => (await pool.query("select rate_hit($1, $2, $3) as ok", [key, windowSec, max])).rows[0].ok as boolean;
  const keys: string[] = [];
  const fresh = () => {
    const k = `test:${randomUUID()}`;
    keys.push(k);
    return k;
  };
  after(async () => {
    await pool.query("delete from rate_hits where key = any ($1)", [keys]);
  });

  test("창 안에서 max번까지만 통과하고, 키마다 따로 센다", async () => {
    const key = fresh();
    assert.deepEqual([await hit(key), await hit(key), await hit(key), await hit(key), await hit(key)], [true, true, true, false, false]);
    assert.equal(await hit(fresh()), true);
  });

  test("창이 끝나면 처음부터 다시 센다", async () => {
    const key = fresh();
    assert.deepEqual([await hit(key, 60, 1), await hit(key, 60, 1)], [true, false]);
    await pool.query("update rate_hits set reset_at = now() - interval '1 second' where key = $1", [key]);
    assert.equal(await hit(key, 60, 1), true);
    assert.equal((await pool.query("select n from rate_hits where key = $1", [key])).rows[0].n, 1);
  });

  test("동시에 와도 한도를 넘어 통과하지 못한다", async () => {
    const key = fresh();
    const results = await Promise.all(Array.from({ length: 12 }, () => hit(key, 60, 3)));
    assert.equal(results.filter(Boolean).length, 3);
  });

  test("앱 역할은 표도 함수도 못 쓴다", async () => {
    await rejects(rows(alice, "select rate_hit('x', 60, 3)"), /permission denied/);
    await rejects(rows(alice, "select * from rate_hits"), /permission denied/);
  });
});

describe("내 기록 링크(record_shares)", () => {
  test("앱 역할은 읽지도 쓰지도 못하고, 계정을 지우면 함께 지워진다", async () => {
    const owner = await makeUser("링크 보낸 사람");
    const hash = createHash("sha256").update(randomUUID()).digest("hex");
    await pool.query(`insert into record_shares (token_hash, user_id, payload, expires_at) values ($1, $2, '{"v":1,"enc":"x"}', now() + interval '7 days')`, [hash, owner]);
    await rejects(rows(owner, "select * from record_shares"), /permission denied/);
    await rejects(rows(owner, "insert into record_shares (token_hash, user_id, payload, expires_at) values ($1, $2, '{}', now())", [hash.replace(/^./, "0"), owner]), /permission denied/);
    await pool.query(`delete from "user" where id = $1`, [owner]);
    assert.equal((await pool.query("select 1 from record_shares where token_hash = $1", [hash])).rows.length, 0);
  });

  test("해시 모양이 아니거나 받을 횟수가 범위 밖이면 넣을 수 없다", async () => {
    const owner = await makeUser("링크 검사");
    await rejects(pool.query(`insert into record_shares (token_hash, user_id, payload, expires_at) values ('abc', $1, '{}', now())`, [owner]), /check/);
    const hash = createHash("sha256").update(randomUUID()).digest("hex");
    await rejects(pool.query(`insert into record_shares (token_hash, user_id, payload, max_claims, expires_at) values ($1, $2, '{}', 0, now())`, [hash, owner]), /check/);
  });
});

describe("토스 정리", () => {
  test("토스 연결 코드 표와 토스 알림 칸은 없다", async () => {
    assert.equal((await pool.query("select to_regclass('public.toss_link_codes') as t")).rows[0].t, null);
    assert.equal((await pool.query("select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'toss_reminders'")).rowCount, 0);
  });
});

describe("명절 알림(notifications kind = holiday)", () => {
  const ins = async (uid: string, offset: number, label = "christmas", date = "2026-12-25") =>
    (
      await pool.query(
        `insert into notifications (user_id, kind, event_date, offset_days, label) values ($1, 'holiday', $2::date, $3, $4)
         on conflict (user_id, event_date, offset_days, label) where kind = 'holiday' do nothing returning id`,
        [uid, date, offset, label],
      )
    ).rowCount;

  test("같은 사람·날·알림 시점·이름은 한 번만 남고, 다르면 따로 남는다(사람 없이도: contact_id는 비어 있다)", async () => {
    assert.equal(await ins(alice, 7), 1);
    assert.equal(await ins(alice, 7), 0, "같은 알림은 겹치지 않는다");
    assert.equal(await ins(alice, 0), 1, "알림 시점이 다르면 따로");
    assert.equal(await ins(alice, 7, "seollal", "2027-02-07"), 1, "날이 다르면 따로");
    assert.equal(await ins(bob, 7), 1, "다른 사람은 따로");
  });

  test("사람 알림(생일)의 겹침 방지는 그대로(contact_id가 있을 때)", async () => {
    const c = await person(alice, "생일 겹침");
    const add = async () =>
      (
        await pool.query(
          `insert into notifications (user_id, kind, contact_id, event_date, offset_days, label) values ($1, 'birthday', $2, '2026-12-01', 7, '')
           on conflict on constraint notifications_once do nothing returning id`,
          [alice, c],
        )
      ).rowCount;
    assert.equal(await add(), 1);
    assert.equal(await add(), 0);
  });

  test("알 수 없는 종류는 막고, 앱 역할은 남의 알림을 못 읽는다", async () => {
    await rejects(pool.query(`insert into notifications (user_id, kind) values ($1, 'nope')`, [alice]), /notifications_kind_check/);
    const mine = await rows(alice, "select label from notifications where kind = 'holiday'");
    assert.ok(mine.length >= 3);
    assert.equal((await rows(carol, "select 1 from notifications where kind = 'holiday'")).length, 0);
  });
});

describe("물어보기 링크: 30일·한 질문(0033)", () => {
  /** 앱 역할로 링크를 만들되 기간(일)과 질문을 고른다 */
  async function askFor(uid: string, contactId: string, days: number, questions: string[] | null) {
    const t = token();
    await rows(
      uid,
      `insert into invites (inviter_id, contact_id, token_hash, code, sections, expires_at, questions)
       values ($1, $2, $3, $4, array['favorites'], now() + make_interval(days => $5), $6)`,
      [uid, contactId, t.hash, t.code, days, questions],
    );
    return t;
  }

  test("30일까지 열 수 있고 그보다 길면 막힌다(예전 8일 제약은 없다)", async () => {
    const c = await person(alice, "삼십일");
    await askFor(alice, c, 30, null);
    await askFor(alice, c, 7, null);
    await rejects(askFor(alice, c, 32, null), /invites_expires_check/);
  });

  test("질문 id는 1~3개를 담고(비워 두면 항목 전체), 답하는 화면용 함수가 돌려준다", async () => {
    const c = await person(alice, "한질문");
    const t = await askFor(alice, c, 30, ["scent"]);
    const [r] = (await pool.query("select * from request_for_answer($1)", [t.hash])).rows;
    assert.deepEqual(r.questions, ["scent"]);
    assert.deepEqual(r.sections, ["favorites"]);
    assert.equal(r.state, "active");
    const plain = await askFor(alice, c, 7, null);
    assert.equal((await pool.query("select * from request_for_answer($1)", [plain.hash])).rows[0].questions, null);
    await rejects(askFor(alice, c, 7, []), /invites_questions_check/);
    await rejects(askFor(alice, c, 7, ["a", "b", "c", "d"]), /invites_questions_check/);
  });

  test("질문 링크에 답하면 그 항목 칸에 들어가고 링크는 쓰인 것이 된다", async () => {
    const c = await person(alice, "답하는 한질문");
    const t = await askFor(alice, c, 30, ["scent"]);
    await answer(t.hash, { favorites: { v: 1, data: {} } });
    assert.equal((await pool.query("select * from request_for_answer($1)", [t.hash])).rows[0].state, "used");
  });
});
