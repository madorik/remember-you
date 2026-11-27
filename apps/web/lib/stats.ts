import "server-only";
import { asSystem, type Q } from "./db";
import { DAY, kstStart, parsePeriod, todayKst, type Period } from "./period";

// 우리 통계(/admin) 숫자. 기간(한국 날짜, 시작·끝 포함)으로 센다. 데모 계정은 빼고, 로그인 전 방문(시작 화면·가이드·가족 카드)은 기기 id(anon)로 센다.
// 화면 보기·머문 시간·유입은 이용 기록(app_events)이 쌓인 날부터 보인다. 표가 아직 없으면 그 칸만 비운다

export { parsePeriod, todayKst, type Period };

const REAL = `not coalesce(u."isAnonymous", false)`;
const num = (v: unknown) => Number(v ?? 0) || 0;

async function safe<T>(fn: (q: Q) => Promise<T>): Promise<T | null> {
  try {
    return await asSystem(fn);
  } catch (e) {
    console.warn("stats failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export interface Kpis {
  signups: number;
  active: number;
  visitors: number;
  visits: number;
  avgDau: number;
  wau: number;
  mau: number;
  pageViews: number;
  /** 활성 사용자 하루 평균 사용 시간(ms) */
  timePerUserDay: number;
  sessions: number;
  giftClicks: number;
}

async function kpis(start: string, end: string, days: number): Promise<Kpis | null> {
  return safe(async (q) => {
    const r = await q.one(
      `with ev as (
         select e.*, u.id as uid from app_events e left join "user" u on u.id = e.user_id
         where e.at >= $1::timestamptz and e.at < $2::timestamptz and (e.user_id is null or ${REAL})
       )
       select
         (select count(*) from "user" u where u."createdAt" >= $1::timestamptz and u."createdAt" < $2::timestamptz and ${REAL}) as signups,
         (select count(distinct uid) from ev where uid is not null) as active,
         (select count(distinct coalesce(anon, user_id)) from ev where name = 'visit') as visitors,
         (select count(*) from ev where name = 'visit') as visits,
         (select count(*) from (select distinct uid, (at at time zone 'Asia/Seoul')::date from ev where uid is not null) d) as user_days,
         (select count(distinct e.user_id) from app_events e join "user" u on u.id = e.user_id where ${REAL} and e.at >= $2::timestamptz - interval '7 days' and e.at < $2::timestamptz) as wau,
         (select count(distinct e.user_id) from app_events e join "user" u on u.id = e.user_id where ${REAL} and e.at >= $2::timestamptz - interval '30 days' and e.at < $2::timestamptz) as mau,
         (select count(*) from ev where name = 'page_view') as page_views,
         (select coalesce(sum(value), 0) from ev where name = 'page_time' and uid is not null) as time_ms,
         (select count(*) from ev where name = 'gift_click') as gift_clicks`,
      [start, end],
    );
    const sessions = await q.one(
      `with ev as (
         select coalesce(e.user_id, 'a:' || e.anon) as who, e.at from app_events e left join "user" u on u.id = e.user_id
         where e.name = 'page_view' and e.at >= $1::timestamptz and e.at < $2::timestamptz and (e.user_id is null or ${REAL}) and coalesce(e.user_id, e.anon) is not null
       )
       select count(*) as n from (select at - lag(at) over (partition by who order by at) as gap from ev) s where gap is null or gap > interval '30 minutes'`,
      [start, end],
    );
    const userDays = num(r?.user_days);
    return {
      signups: num(r?.signups),
      active: num(r?.active),
      visitors: num(r?.visitors),
      visits: num(r?.visits),
      avgDau: userDays / days,
      wau: num(r?.wau),
      mau: num(r?.mau),
      pageViews: num(r?.page_views),
      timePerUserDay: userDays ? num(r?.time_ms) / userDays : 0,
      sessions: num(sessions?.n),
      giftClicks: num(r?.gift_clicks),
    };
  });
}

export interface DayRow {
  day: string;
  dau: number;
  signups: number;
  visitors: number;
  pageViews: number;
}

async function daily(start: string, end: string, from: string, to: string): Promise<DayRow[] | null> {
  return safe(async (q) => {
    const rows = await q<{ day: string; dau: unknown; signups: unknown; visitors: unknown; pv: unknown }>(
      `with days as (select to_char(d, 'YYYY-MM-DD') as day from generate_series($3::date, $4::date, interval '1 day') d),
       act as (select to_char(e.at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day, count(distinct e.user_id) as n from app_events e join "user" u on u.id = e.user_id
               where ${REAL} and e.at >= $1::timestamptz and e.at < $2::timestamptz group by 1),
       sig as (select to_char(u."createdAt" at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day, count(*) as n from "user" u
               where ${REAL} and u."createdAt" >= $1::timestamptz and u."createdAt" < $2::timestamptz group by 1),
       vis as (select to_char(e.at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day, count(distinct coalesce(e.anon, e.user_id)) as n from app_events e
               where e.name = 'visit' and e.at >= $1::timestamptz and e.at < $2::timestamptz group by 1),
       pv as (select to_char(e.at at time zone 'Asia/Seoul', 'YYYY-MM-DD') as day, count(*) as n from app_events e left join "user" u on u.id = e.user_id
              where e.name = 'page_view' and (e.user_id is null or ${REAL}) and e.at >= $1::timestamptz and e.at < $2::timestamptz group by 1)
       select days.day, act.n as dau, sig.n as signups, vis.n as visitors, pv.n as pv
       from days left join act using (day) left join sig using (day) left join vis using (day) left join pv using (day) order by days.day`,
      [start, end, from, to],
    );
    return rows.map((r) => ({ day: r.day, dau: num(r.dau), signups: num(r.signups), visitors: num(r.visitors), pageViews: num(r.pv) }));
  });
}

export interface FunnelStep {
  key: string;
  label: string;
  n: number;
}

/** 온보딩 첫 메모를 저장한 사람이 어떻게 적었나, 건너뛴 사람(가입한 사람 수) */
export interface FirstMemoStats {
  byVoice: number;
  byText: number;
  skipped: number;
}

async function funnel(start: string, end: string): Promise<{ steps: FunnelStep[]; onboarding: FunnelStep[]; firstMemo: FirstMemoStats } | null> {
  return safe(async (q) => {
    const r = await q.one(
      `with c as (select u.id from "user" u where ${REAL} and u."createdAt" >= $1::timestamptz and u."createdAt" < $2::timestamptz),
       ev as (select e.user_id, e.name, e.path, e.source from app_events e join c on c.id = e.user_id)
       select
         (select count(*) from c) as signup,
         (select count(*) from c join profiles p on p.id = c.id where p.onboarded_at is not null) as onboarded,
         (select count(distinct x.user_id) from contacts x join c on c.id = x.user_id) as person,
         (select count(distinct k.author_id) from contact_cards k join c on c.id = k.author_id where k.sections <> '{}'::jsonb) as record,
         (select count(distinct i.inviter_id) from invites i join c on c.id = i.inviter_id) as ask,
         (select count(distinct i.inviter_id) from invites i join c on c.id = i.inviter_id where i.used_at is not null) as answered,
         (select count(distinct user_id) from ev where name = 'gift_picks_view') as gift_view,
         (select count(distinct user_id) from ev where name = 'gift_click') as gift_click,
         (select count(distinct user_id) from ev where name = 'page_view' and path = '/onboarding') as ob_open,
         (select count(distinct user_id) from ev where name = 'onboarding_done' and source like 'memo%') as ob_memo,
         (select count(distinct user_id) from ev where name = 'onboarding_done' and source = 'memo_voice') as ob_voice,
         (select count(distinct user_id) from ev where name = 'onboarding_done' and source = 'memo_text') as ob_text,
         (select count(distinct user_id) from ev where name = 'onboarding_skip') as ob_skip`,
      [start, end],
    );
    return {
      steps: [
        { key: "signup", label: "가입", n: num(r?.signup) },
        { key: "onboarded", label: "온보딩 끝", n: num(r?.onboarded) },
        { key: "person", label: "사람 더함", n: num(r?.person) },
        { key: "record", label: "그 사람 기록 적음", n: num(r?.record) },
        { key: "ask", label: "물어보기 보냄", n: num(r?.ask) },
        { key: "answered", label: "답 받음", n: num(r?.answered) },
        { key: "gift_view", label: "선물 추천 봄", n: num(r?.gift_view) },
        { key: "gift_click", label: "쿠팡 링크 누름", n: num(r?.gift_click) },
      ],
      onboarding: [
        { key: "signup", label: "가입", n: num(r?.signup) },
        { key: "ob_open", label: "첫 메모 화면 열기", n: num(r?.ob_open) },
        { key: "ob_memo", label: "첫 메모 저장", n: num(r?.ob_memo) },
      ],
      firstMemo: { byVoice: num(r?.ob_voice), byText: num(r?.ob_text), skipped: num(r?.ob_skip) },
    };
  });
}

export interface Retention {
  /** 기간에 가입한 사람의 1·7·30일 뒤 다시 온 비율(그날이 지난 사람만) */
  day: { n: number; eligible: number; back: number }[];
  /** 주별 가입 묶음 × 몇 주 뒤 다시 왔나(최근 8주) */
  cohorts: { week: string; size: number; weeks: (number | null)[] }[];
}

async function retention(start: string, end: string, today: string): Promise<Retention | null> {
  return safe(async (q) => {
    const d = await q<{ n: number; eligible: unknown; back: unknown }>(
      `with c as (select u.id, (u."createdAt" at time zone 'Asia/Seoul')::date as d0 from "user" u where ${REAL} and u."createdAt" >= $1::timestamptz and u."createdAt" < $2::timestamptz),
       a as (select distinct e.user_id, (e.at at time zone 'Asia/Seoul')::date as d from app_events e join c on c.id = e.user_id),
       n as (select unnest(array[1, 7, 30]) as n)
       select n.n, count(distinct c.id) filter (where c.d0 + n.n <= $3::date) as eligible,
              count(distinct c.id) filter (where c.d0 + n.n <= $3::date and exists (select 1 from a where a.user_id = c.id and a.d = c.d0 + n.n)) as back
       from n cross join c group by n.n order by n.n`,
      [start, end, today],
    );
    const rows = await q<{ week: string; size: unknown; w: number | null; n: unknown }>(
      `with c as (select u.id, (u."createdAt" at time zone 'Asia/Seoul')::date as d0 from "user" u
                  where ${REAL} and u."createdAt" >= $1::timestamptz - interval '56 days' and u."createdAt" < $1::timestamptz),
       a as (select distinct e.user_id, (e.at at time zone 'Asia/Seoul')::date as d from app_events e join c on c.id = e.user_id)
       select to_char(date_trunc('week', c.d0), 'YYYY-MM-DD') as week, count(distinct c.id) over (partition by date_trunc('week', c.d0)) as size,
              ((a.d - c.d0) / 7) as w, count(distinct a.user_id) over (partition by date_trunc('week', c.d0), ((a.d - c.d0) / 7)) as n
       from c left join a on a.user_id = c.id`,
      [end],
    );
    const byWeek = new Map<string, { size: number; weeks: Map<number, number> }>();
    for (const r of rows) {
      const w = byWeek.get(r.week) ?? { size: num(r.size), weeks: new Map() };
      if (r.w != null && r.w >= 1 && r.w <= 7) w.weeks.set(r.w, Math.max(w.weeks.get(r.w) ?? 0, num(r.n)));
      byWeek.set(r.week, w);
    }
    const todayT = kstStart(today);
    const cohorts = [...byWeek.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([week, v]) => ({
        week,
        size: v.size,
        weeks: Array.from({ length: 7 }, (_, i) => (kstStart(week) + (i + 1) * 7 * DAY <= todayT ? (v.size ? (v.weeks.get(i + 1) ?? 0) / v.size : 0) : null)),
      }));
    return { day: d.map((r) => ({ n: r.n, eligible: num(r.eligible), back: num(r.back) })), cohorts };
  });
}

export interface PageRow {
  path: string;
  views: number;
  users: number;
  totalMs: number;
  exits: number;
}

async function pages(start: string, end: string): Promise<PageRow[] | null> {
  return safe(async (q) => {
    const rows = await q<{ path: string; views: unknown; users: unknown; total: unknown; exits: unknown }>(
      `with ev as (
         select coalesce(e.user_id, 'a:' || e.anon) as who, e.name, e.path, e.value, e.at from app_events e left join "user" u on u.id = e.user_id
         where e.name in ('page_view', 'page_time') and e.path is not null and e.at >= $1::timestamptz and e.at < $2::timestamptz and (e.user_id is null or ${REAL})
       ),
       pv as (select * from ev where name = 'page_view' and who is not null),
       s as (select who, at, path, sum(case when gap is null or gap > interval '30 minutes' then 1 else 0 end) over (partition by who order by at) as sid
             from (select who, at, path, at - lag(at) over (partition by who order by at) as gap from pv) x),
       ex as (select path, count(*) as exits from (select distinct on (who, sid) who, sid, path from s order by who, sid, at desc) l group by path),
       agg as (select path, count(*) filter (where name = 'page_view') as views, count(distinct who) filter (where name = 'page_view') as users,
                      coalesce(sum(value) filter (where name = 'page_time'), 0) as total from ev group by path)
       select agg.path, agg.views, agg.users, agg.total, coalesce(ex.exits, 0) as exits from agg left join ex using (path) where agg.views > 0 order by agg.views desc limit 40`,
      [start, end],
    );
    return rows.map((r) => ({ path: r.path, views: num(r.views), users: num(r.users), totalMs: num(r.total), exits: num(r.exits) }));
  });
}

/** 이탈: 7일 넘게 안 온 사람(마지막으로 본 화면별)과 가입하고 다시 안 온 사람 */
async function churn(end: string): Promise<{ lastPages: { path: string; n: number }[]; churned: number; tracked: number } | null> {
  return safe(async (q) => {
    const rows = await q<{ path: string; n: unknown }>(
      `with last as (
         select distinct on (e.user_id) e.user_id, e.path, e.at from app_events e join "user" u on u.id = e.user_id
         where ${REAL} and e.name = 'page_view' and e.path is not null and e.at < $1::timestamptz order by e.user_id, e.at desc
       )
       select path, count(*) as n from last where at < $1::timestamptz - interval '7 days' group by path order by n desc limit 12`,
      [end],
    );
    const t = await q.one(
      `select count(distinct e.user_id) as tracked,
              count(distinct e.user_id) filter (where not exists (select 1 from app_events x where x.user_id = e.user_id and x.at >= $1::timestamptz - interval '7 days' and x.at < $1::timestamptz)) as churned
       from app_events e join "user" u on u.id = e.user_id where ${REAL} and e.at < $1::timestamptz`,
      [end],
    );
    return { lastPages: rows.map((r) => ({ path: r.path, n: num(r.n) })), churned: num(t?.churned), tracked: num(t?.tracked) };
  });
}

export interface CountRow {
  key: string;
  n: number;
  users: number;
}

async function features(start: string, end: string): Promise<CountRow[] | null> {
  return safe(async (q) => {
    const rows = await q<{ name: string; n: unknown; users: unknown }>(
      `select e.name, count(*) as n, count(distinct coalesce(e.user_id, e.anon)) as users from app_events e left join "user" u on u.id = e.user_id
       where e.name not in ('visit', 'page_view', 'page_time') and e.at >= $1::timestamptz and e.at < $2::timestamptz and (e.user_id is null or ${REAL})
       group by 1 order by 2 desc`,
      [start, end],
    );
    return rows.map((r) => ({ key: r.name, n: num(r.n), users: num(r.users) }));
  });
}

export interface ChannelRow {
  source: string;
  visits: number;
  visitors: number;
  signups: number;
}

async function acquisition(start: string, end: string): Promise<{ channels: ChannelRow[]; refs: CountRow[]; campaigns: CountRow[]; landings: CountRow[] } | null> {
  return safe(async (q) => {
    const channels = await q<{ source: string; visits: unknown; visitors: unknown; signups: unknown }>(
      `with v as (select e.anon, coalesce(e.source, 'direct') as source, e.at from app_events e where e.name = 'visit' and e.at >= $1::timestamptz and e.at < $2::timestamptz),
       first as (select distinct on (anon) anon, source, at from v where anon is not null order by anon, at),
       link as (select distinct e.anon, e.user_id from app_events e where e.user_id is not null and e.anon in (select anon from first)),
       conv as (select f.source, count(distinct u.id) as n from first f join link l on l.anon = f.anon join "user" u on u.id = l.user_id
                where ${REAL} and u."createdAt" >= f.at - interval '1 hour' and u."createdAt" < $2::timestamptz + interval '1 day' group by 1),
       agg as (select source, count(*) as visits, count(distinct anon) as visitors from v group by 1)
       select agg.source, agg.visits, agg.visitors, coalesce(conv.n, 0) as signups from agg left join conv using (source) order by agg.visits desc`,
      [start, end],
    );
    const top = (col: string) =>
      q<{ key: string; n: unknown; users: unknown }>(
        `select ${col} as key, count(*) as n, count(distinct anon) as users from app_events e
         where e.name = 'visit' and ${col} is not null and e.at >= $1::timestamptz and e.at < $2::timestamptz group by 1 order by 2 desc limit 12`,
        [start, end],
      );
    const [refs, campaigns, landings] = await Promise.all([top("e.ref"), top("e.campaign"), top("e.path")]);
    const rows = (r: { key: string; n: unknown; users: unknown }[]) => r.map((x) => ({ key: x.key, n: num(x.n), users: num(x.users) }));
    return {
      channels: channels.map((r) => ({ source: r.source, visits: num(r.visits), visitors: num(r.visitors), signups: num(r.signups) })),
      refs: rows(refs),
      campaigns: rows(campaigns),
      landings: rows(landings),
    };
  });
}

async function devices(start: string, end: string): Promise<{ platforms: CountRow[]; os: CountRow[]; browsers: CountRow[] } | null> {
  return safe(async (q) => {
    const platforms = await q<{ key: string; n: unknown; users: unknown }>(
      `select coalesce(e.platform, 'web') as key, count(*) as n, count(distinct e.user_id) as users from app_events e join "user" u on u.id = e.user_id
       where ${REAL} and e.name = 'page_view' and e.at >= $1::timestamptz and e.at < $2::timestamptz group by 1 order by 3 desc`,
      [start, end],
    );
    const by = (col: string) =>
      q<{ key: string; n: unknown; users: unknown }>(
        `select ${col} as key, count(*) as n, count(distinct coalesce(e.anon, e.user_id)) as users from app_events e
         where e.name = 'visit' and ${col} is not null and e.at >= $1::timestamptz and e.at < $2::timestamptz group by 1 order by 3 desc`,
        [start, end],
      );
    const [os, browsers] = await Promise.all([by("e.os"), by("e.browser")]);
    const rows = (r: { key: string; n: unknown; users: unknown }[]) => r.map((x) => ({ key: x.key, n: num(x.n), users: num(x.users) }));
    return { platforms: rows(platforms), os: rows(os), browsers: rows(browsers) };
  });
}

async function gifts(start: string, end: string): Promise<{ topItems: CountRow[]; byBand: CountRow[]; bySource: CountRow[] } | null> {
  return safe(async (q) => {
    const by = (col: string, limit: number) =>
      q<{ key: string; n: unknown; users: unknown }>(
        `select ${col} as key, count(*) as n, count(distinct coalesce(e.user_id, e.anon)) as users from app_events e left join "user" u on u.id = e.user_id
         where e.name = 'gift_click' and ${col} is not null and e.at >= $1::timestamptz and e.at < $2::timestamptz and (e.user_id is null or ${REAL})
         group by 1 order by 2 desc limit ${limit}`,
        [start, end],
      );
    const [topItems, byBand, bySource] = await Promise.all([by("e.item", 12), by("e.band", 4), by("e.source", 6)]);
    const rows = (r: { key: string; n: unknown; users: unknown }[]) => r.map((x) => ({ key: x.key, n: num(x.n), users: num(x.users) }));
    return { topItems: rows(topItems), byBand: rows(byBand), bySource: rows(bySource) };
  });
}

export interface Totals {
  real: number;
  demo: number;
  onboarded: number;
  contacts: number;
  notes: number;
  asks: number;
  answered: number;
  installs: { platform: string; n: number }[];
  trackingSince: string | null;
}

async function totals(): Promise<Totals | null> {
  return safe(async (q) => {
    const r = await q.one(
      `select (select count(*) from "user" u where ${REAL}) as real, (select count(*) from "user" u where not (${REAL})) as demo,
              (select count(*) from profiles p join "user" u on u.id = p.id where p.onboarded_at is not null and ${REAL}) as onboarded,
              (select count(*) from contacts c join "user" u on u.id = c.user_id where ${REAL}) as contacts,
              (select count(*) from notes n join "user" u on u.id = n.author_id where ${REAL}) as notes,
              (select count(*) from invites i join "user" u on u.id = i.inviter_id where ${REAL}) as asks,
              (select count(*) from invites i join "user" u on u.id = i.inviter_id where ${REAL} and i.used_at is not null) as answered,
              (select to_char(min(at) at time zone 'Asia/Seoul', 'YYYY-MM-DD') from app_events where name = 'page_view') as since`,
    );
    const installs = await q<{ platform: string; n: unknown }>(`select t.platform, count(distinct t.user_id) as n from push_tokens t join "user" u on u.id = t.user_id where ${REAL} group by 1 order by 2 desc`);
    return {
      real: num(r?.real),
      demo: num(r?.demo),
      onboarded: num(r?.onboarded),
      contacts: num(r?.contacts),
      notes: num(r?.notes),
      asks: num(r?.asks),
      answered: num(r?.answered),
      installs: installs.map((x) => ({ platform: x.platform, n: num(x.n) })),
      trackingSince: (r?.since as string | null) ?? null,
    };
  });
}

export interface Stats {
  period: Period;
  kpis: Kpis | null;
  prev: Kpis | null;
  daily: DayRow[] | null;
  funnel: Awaited<ReturnType<typeof funnel>>;
  retention: Retention | null;
  pages: PageRow[] | null;
  churn: Awaited<ReturnType<typeof churn>>;
  features: CountRow[] | null;
  acquisition: Awaited<ReturnType<typeof acquisition>>;
  devices: Awaited<ReturnType<typeof devices>>;
  gifts: Awaited<ReturnType<typeof gifts>>;
  totals: Totals | null;
  /** 화면·유입 기록이 쌓이기 시작한 날(그 기록을 쓰는 탭에서만 읽는다) */
  trackingSince: string | null;
}

/** 탭: 한 번에 다 읽으면 DB 비용이 크니, 고른 탭에 필요한 쿼리만 돌린다 */
export const TABS = [
  ["summary", "요약·추이"],
  ["acquisition", "유입"],
  ["funnel", "퍼널"],
  ["retention", "리텐션"],
  ["pages", "화면"],
  ["features", "기능"],
  ["devices", "기기"],
  ["gifts", "선물"],
  ["totals", "누적"],
] as const;
export type Tab = (typeof TABS)[number][0];

export function parseTab(v: unknown): Tab {
  return TABS.find(([id]) => id === v)?.[0] ?? "summary";
}

async function trackingSince(): Promise<string | null> {
  const r = await safe((q) => q.one(`select to_char(min(at) at time zone 'Asia/Seoul', 'YYYY-MM-DD') as since from app_events where name = 'page_view'`));
  return (r?.since as string | null | undefined) ?? null;
}

/** 고른 탭에 필요한 것만 읽는다(나머지는 null). 퍼널 탭의 '나간 곳'은 화면 기록(pages)을, 선물 탭은 기능 기록(features)을 같이 쓴다 */
export async function loadStats(period: Period, tab: Tab = "summary"): Promise<Stats> {
  const start = new Date(kstStart(period.from)).toISOString();
  const end = new Date(kstStart(period.to) + DAY).toISOString();
  const pStart = new Date(kstStart(period.prevFrom)).toISOString();
  const pEnd = new Date(kstStart(period.prevTo) + DAY).toISOString();
  const none = Promise.resolve(null);
  const on = (...tabs: Tab[]) => tabs.includes(tab);
  const [k, prev, d, f, ret, pg, ch, ft, acq, dev, gf, tot, since] = await Promise.all([
    on("summary") ? kpis(start, end, period.days) : none,
    on("summary") ? kpis(pStart, pEnd, period.days) : none,
    on("summary") ? daily(start, end, period.from, period.to) : none,
    on("funnel") ? funnel(start, end) : none,
    on("retention") ? retention(start, end, todayKst()) : none,
    on("funnel", "pages") ? pages(start, end) : none,
    on("funnel") ? churn(end) : none,
    on("features", "gifts") ? features(start, end) : none,
    on("acquisition") ? acquisition(start, end) : none,
    on("devices") ? devices(start, end) : none,
    on("gifts") ? gifts(start, end) : none,
    on("totals") ? totals() : none,
    on("summary", "acquisition", "pages") ? trackingSince() : none,
  ]);
  return { period, kpis: k, prev, daily: d, funnel: f, retention: ret, pages: pg, churn: ch, features: ft, acquisition: acq, devices: dev, gifts: gf, totals: tot, trackingSince: since };
}
