import { diffDays, dueHolidays, dueWithCatchUp, eventPath, eventTitle, holidayNoticeTitle, isLocale, reminderBody, sanitizeOffsets, sanitizeSection, todayIn, translate, type DatesData, type PersonDates } from "@readme/core";
import { NextResponse, type NextRequest } from "next/server";
import { aad, open } from "@/lib/crypto";
import { asSystem, systemQuery } from "@/lib/db";
import { tidyUsage } from "@/lib/housekeeping";
import { pushToToken } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 매일 아침 한 번(vercel.json): ① 웹 브라우저 알림을 켠 사람에게 오늘 알릴 생일·기념일과 명절·챙기는 날(설날·추석·크리스마스 …, 설정에서 켠 사람만)을 알림으로 남기고 웹 푸시로 보내고, ② 정리(데모 계정·이용 기록·표 청소)를 한다.
// 앱(안드로이드·iOS)은 생일·기념일 알림을 기기에 직접 예약하니(components/native.tsx) 여기서 보내지 않는다(서버 푸시까지 보내면 두 번 온다). 서버 푸시는 답장처럼 기기가 알 수 없는 것만(lib/push).
// 그래서 브라우저 구독이 있는 사람만 읽는다: 보낼 곳이 없는 사람의 기록까지 풀어 보지 않는다(웹 푸시 키(VAPID)가 없으면 구독도 생기지 않는다).
// 시스템 권한으로 모든 사람을 보므로, 각자 자기 주소록 사람의 기록(contact_cards)만 읽도록 쿼리에서 직접 지킨다.
// 어제 크론이 못 돌았어도 어제 알렸어야 할 것(아직 안 지난 것)을 오늘 보낸다(dueWithCatchUp). 같은 알림은 notifications_once로 한 번만.

const BATCH = 200;
/** 사람을 이만큼씩 동시에 처리한다(차례로 하면 사람이 늘수록 함수 시간 제한에 닿는다) */
const CONCURRENCY = 8;

function datesOf(payload: unknown, scope: string): DatesData | null {
  const data = open(payload, scope);
  return data ? sanitizeSection("dates", data) : null;
}

type Source = {
  user_id: string;
  contact_id: string;
  name: string;
  payload: unknown;
};

type Profile = {
  id: string;
  locale: string | null;
  system_locale: string;
  time_zone: string;
  reminder_offsets: number[];
  holiday_reminders: boolean;
};

type Token = { token: string; platform: string };

type Counts = { created: number; pushed: number; failed: number };

/** 사람 한 명의 알림: 오늘 알릴 것을 알림으로 남기고(겹치면 건너뜀) 이 사람의 브라우저들로 보낸다. 만든 수·보낸 수·실패 수는 counts에 더한다 */
async function remindOne(profile: Profile, sources: Source[], counts: Counts): Promise<void> {
  const me = profile.id;
  const locale = isLocale(profile.locale) ? profile.locale : isLocale(profile.system_locale) ? profile.system_locale : "ko";
  const today = todayIn(profile.time_zone || "Asia/Seoul");
  const offsets = sanitizeOffsets(profile.reminder_offsets);
  const tokens = await systemQuery<Token>("select token, platform from push_tokens where user_id = $1 and platform = 'web'", [me]);
  if (!tokens.length) return;
  await remindPeople(profile, sources, tokens, locale, today, offsets, counts);
  // 명절·챙기는 날은 사람 기록과 상관없다(등록한 사람이 없어도 받는다)
  if (profile.holiday_reminders) await remindHolidays(me, tokens, locale, today, offsets, counts);
}

/** 한 알림을 이 사람의 브라우저들로 보낸다. 하나라도 갔으면 알림 행에 보낸 때를 적는다 */
async function deliver(me: string, tokens: Token[], notificationId: string, title: string, body: string, path: string, counts: Counts): Promise<void> {
  const sent = (await Promise.all(tokens.map((tk) => pushToToken(me, tk, title, body, path)))).some(Boolean);
  if (sent) {
    counts.pushed++;
    await systemQuery("update notifications set pushed_at = now() where id = $1", [notificationId]);
  }
}

async function remindHolidays(me: string, tokens: Token[], locale: "ko" | "en", today: ReturnType<typeof todayIn>, offsets: ReturnType<typeof sanitizeOffsets>, counts: Counts): Promise<void> {
  const due = dueHolidays(today, offsets);
  for (const { holiday, offset } of due) {
    // 알림 하나가 실패해도 나머지는 계속 보낸다(알림 행은 이미 남았으니 다음 번에 다시 만들지 않는다)
    try {
      const row = await asSystem((q) =>
        q.one<{ id: string }>(
          `insert into notifications (user_id, kind, event_date, offset_days, label)
           values ($1, 'holiday', make_date($2, $3, $4), $5, $6)
           on conflict (user_id, event_date, offset_days, label) where kind = 'holiday' do nothing
           returning id`,
          [me, holiday.date.y, holiday.date.m, holiday.date.d, offset, holiday.id],
        ),
      );
      if (!row) continue;
      counts.created++;
      // 남은 날은 오늘 기준으로(어제 것을 오늘 보내면 offset보다 하루 적다)
      await deliver(me, tokens, row.id, holidayNoticeTitle(locale, holiday.id, diffDays(today, holiday.date)), translate(locale, "notif.holidayBody"), "/people?pick=1&to=gift", counts);
    } catch (err) {
      counts.failed++;
      console.warn("holiday reminder failed", err instanceof Error ? err.message : err);
    }
  }
}

async function remindPeople(profile: Profile, sources: Source[], tokens: Token[], locale: "ko" | "en", today: ReturnType<typeof todayIn>, offsets: ReturnType<typeof sanitizeOffsets>, counts: Counts): Promise<void> {
  const me = profile.id;
  const people: PersonDates[] = [];
  for (const s of sources) {
    const d = datesOf(s.payload, aad.contact(s.user_id, s.contact_id, "dates"));
    if (d) people.push({ contactId: s.contact_id, name: s.name, birthday: d.birthday, anniversaries: d.anniversaries });
  }
  if (!people.length) return;
  const due = dueWithCatchUp(people, today, offsets);
  if (!due.length) return;

  type Inserted = { id: string; contact_id: string; kind: string; offset_days: number; label: string; event_date: string };
  const inserted = await asSystem(async (q) => {
    const out: Inserted[] = [];
    for (const { event, offset } of due) {
      const row = await q.one<Inserted>(
        `insert into notifications (user_id, kind, contact_id, event_date, offset_days, label)
         values ($1, $2, $3, make_date($4, $5, $6), $7, $8)
         on conflict on constraint notifications_once do nothing
         returning id, contact_id, kind, offset_days, label, to_char(event_date, 'YYYY-MM-DD') as event_date`,
        [me, event.kind, event.contactId, event.date.y, event.date.m, event.date.d, offset, event.label ?? ""],
      );
      if (row) out.push(row);
    }
    return out;
  });
  counts.created += inserted.length;
  if (!inserted.length) return;

  for (const n of inserted) {
    // 알림 하나가 실패해도 같은 사람의 나머지는 계속 보낸다(알림 행은 이미 남았으니 다음 번에 다시 만들지 않는다)
    try {
      const hit = due.find((x) => x.event.contactId === n.contact_id && x.event.kind === n.kind && x.offset === n.offset_days && (x.event.label ?? "") === n.label && `${x.event.date.y}-${String(x.event.date.m).padStart(2, "0")}-${String(x.event.date.d).padStart(2, "0")}` === n.event_date);
      if (!hit) continue;
      const e = hit.event;
      const event = eventTitle(locale, e);
      // 남은 날은 오늘 기준으로(어제 것을 오늘 보내면 offset보다 하루 적다)
      const left = diffDays(today, e.date);
      const title = left <= 0 ? translate(locale, "notif.today", { event }) : translate(locale, "notif.left", { event, n: left });
      await deliver(me, tokens, n.id, title, reminderBody(locale, e, left), eventPath(e), counts);
    } catch (err) {
      counts.failed++;
      console.warn("reminder send failed", err instanceof Error ? err.message : err);
    }
  }
}

/** 브라우저 알림을 켠 사람들의 알림 */
async function remindAll(counts: Counts): Promise<number> {
  let users = 0;
  let after = "";
  for (;;) {
    // id 순서로 이어서 읽는다(OFFSET은 도는 사이 사람이 바뀌면 건너뛰거나 겹친다)
    const profiles = await systemQuery<Profile>(
      `select p.id, p.locale, p.system_locale, p.time_zone, p.reminder_offsets, p.holiday_reminders
         from profiles p
        where p.onboarded_at is not null and p.push_enabled and p.id > $2
          and exists (select 1 from push_tokens t where t.user_id = p.id and t.platform = 'web')
        order by p.id limit $1`,
      [BATCH, after],
    );
    if (!profiles.length) break;
    users += profiles.length;
    after = profiles[profiles.length - 1]!.id;
    const ids = profiles.map((p) => p.id);

    // 내 주소록 사람의 기록 중 생일·기념일 칸(이름은 내가 부르는 말, 없으면 이어진 앱 사용자 이름)
    const sources = await systemQuery<Source>(
      `select c.user_id, c.id as contact_id, coalesce(nullif(c.nickname, ''), p.display_name, '') as name, cc.sections -> 'dates' as payload
         from contacts c
         join contact_cards cc on cc.contact_id = c.id and cc.author_id = c.user_id
         left join profiles p on p.id = c.person_id
        where c.user_id = any ($1) and cc.sections ? 'dates'`,
      [ids],
    );
    // 사람별로 한 번에 묶는다(사람 수 x 기록 수로 훑지 않게)
    const sourcesByUser = new Map<string, Source[]>();
    for (const s of sources) {
      const list = sourcesByUser.get(s.user_id);
      if (list) list.push(s);
      else sourcesByUser.set(s.user_id, [s]);
    }

    for (let i = 0; i < profiles.length; i += CONCURRENCY) {
      await Promise.all(
        profiles.slice(i, i + CONCURRENCY).map(async (profile) => {
          // 한 사람이 실패해도(깨진 값·DB 오류 등) 다른 사람 알림은 계속 보낸다
          try {
            await remindOne(profile, sourcesByUser.get(profile.id) ?? [], counts);
          } catch (err) {
            counts.failed++;
            console.warn("reminder user failed", err instanceof Error ? err.message : err);
          }
        }),
      );
    }
    if (profiles.length < BATCH) break;
  }
  return users;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const counts: Counts = { created: 0, pushed: 0, failed: 0 };
  let users = 0;
  try {
    users = await remindAll(counts);
  } catch (err) {
    counts.failed++;
    console.warn("reminders failed", err instanceof Error ? err.message : err);
  }
  // 데모 계정은 7일 지나면 지운다(카드·연락처·알림은 외래 키로 함께 지워진다)
  let demosRemoved = 0;
  try {
    demosRemoved = (await systemQuery(`delete from "user" where "isAnonymous" and "createdAt" < now() - interval '7 days' returning id`)).length;
  } catch (err) {
    counts.failed++;
    console.warn("demo cleanup failed", err instanceof Error ? err.message : err);
  }
  // 이용 기록 접기·AI 호출 기록·속도 제한·알림 표 청소(표가 끝없이 커지지 않게)
  const tidy = await tidyUsage();
  return NextResponse.json({ users, created: counts.created, pushed: counts.pushed, failed: counts.failed, demosRemoved, tidy });
}
