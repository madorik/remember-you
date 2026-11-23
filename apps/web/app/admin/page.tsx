import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart } from "@/components/admin/LineChart";
import { Wordmark } from "@/components/chrome";
import { CATALOG_BY_ID } from "@/lib/gift-catalog";
import { loadStats, parsePeriod, parseTab, TABS, type CountRow, type FunnelStep, type Kpis, type Tab } from "@/lib/stats";
import { BROWSER_LABEL, CHANNEL_LABEL, FEATURE_LABEL, pageLabel } from "@/lib/usage";
import { adminLogin, adminLogout, isAdmin } from "./auth";

// 우리 통계: 기간(오늘·7일·30일·90일·직접)을 고르면 그 기간과 바로 앞 같은 길이 기간을 견준다.
// 탭: 요약·추이(DAU·가입·방문) / 유입 / 퍼널(가입→…→쿠팡) / 리텐션 / 화면(조회·머문 시간·나간 곳) / 기능 / 기기 / 선물 / 누적. 데모 계정은 뺀다
// 한 번에 다 읽으면 DB 비용이 커서, 탭을 누를 때 그 탭에 필요한 쿼리만 돌린다(lib/stats.ts loadStats(period, tab))

export const metadata: Metadata = { title: "통계", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const fmt = (n: number) => Math.round(n).toLocaleString("ko-KR");
const pct = (a: number, b: number, digits = 1) => (b ? `${(Math.round((a / b) * 100 * 10 ** digits) / 10 ** digits).toFixed(digits)}%` : "—");
function dur(ms: number): string {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}초`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}분 ${s % 60}초`;
  return `${Math.floor(m / 60)}시간 ${m % 60}분`;
}
const BAND_LABEL: Record<string, string> = { "1": "1만원대", "3": "3만원대", "5": "5만원대", "10": "10만원 이상" };
const SOURCE_LABEL: Record<string, string> = { reminder: "선물 힌트 화면", plan: "같이 고르기", card: "가족 카드", guide: "선물 가이드(검색)" };
const PLATFORM_LABEL: Record<string, string> = { ios: "아이폰 앱", android: "안드로이드 앱", web: "웹" };
const OS_LABEL: Record<string, string> = { ios: "iOS", android: "Android", windows: "Windows", mac: "macOS", linux: "Linux", other: "그 밖" };

function Delta({ cur, prev, invert = false }: { cur: number; prev: number | undefined; invert?: boolean }) {
  if (prev == null) return null;
  if (!prev) return cur ? <span className="text-[10.8px] font-semibold text-muted">이전 0 → 새로</span> : null;
  const d = (cur - prev) / prev;
  if (Math.abs(d) < 0.005) return <span className="text-[10.8px] text-muted">이전과 같음</span>;
  const up = d > 0;
  const good = invert ? !up : up;
  return (
    <span className={`text-[10.8px] font-bold ${good ? "text-ok" : "text-red"}`}>
      {up ? "▲" : "▼"} {Math.abs(Math.round(d * 1000) / 10)}% <span className="font-medium text-muted">이전 {fmt(prev)}</span>
    </span>
  );
}

function Kpi({ label, value, cur, prev, hint }: { label: string; value: string; cur?: number; prev?: number; hint?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-white px-4 py-3.5 ring-1 ring-rule">
      <span className="text-[11.3px] font-semibold text-muted">{label}</span>
      <span className="num text-[23.8px] leading-none tracking-[-0.02em]">{value}</span>
      {cur != null ? <Delta cur={cur} prev={prev} /> : null}
      {hint ? <span className="text-[10.4px] leading-[1.4] text-muted">{hint}</span> : null}
    </div>
  );
}

function Section({ id, title, desc, show = true, children }: { id: string; title: string; desc?: string; show?: boolean; children: React.ReactNode }) {
  if (!show) return null;
  return (
    <section id={id} className="scroll-mt-28 pt-10">
      <h2 className="text-[16.2px] font-bold tracking-[-0.02em]">{title}</h2>
      {desc ? <p className="pt-1 text-[11.7px] leading-[1.5] text-muted">{desc}</p> : null}
      <div className="flex flex-col gap-3 pt-4">{children}</div>
    </section>
  );
}

function Empty({ text = "아직 기록이 없어요" }: { text?: string }) {
  return <p className="rounded-2xl bg-white px-4 py-6 text-center text-[12.2px] text-muted ring-1 ring-rule">{text}</p>;
}

/** 이름·막대·숫자 줄(가로 막대) */
function Bars({ rows, total, unit = "" }: { rows: { label: string; n: number; sub?: string }[]; total?: number; unit?: string }) {
  if (!rows.length) return <Empty />;
  const max = Math.max(...rows.map((r) => r.n), 1);
  return (
    <ul className="flex flex-col rounded-2xl bg-white px-4 py-1.5 ring-1 ring-rule">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,38%)_1fr_auto] items-center gap-3 border-t border-rule py-2.5 first:border-t-0">
          <span className="min-w-0 truncate text-[12.2px] font-medium" title={r.label}>
            {r.label}
            {r.sub ? <span className="text-muted"> · {r.sub}</span> : null}
          </span>
          <span className="flex h-2.5 overflow-hidden rounded-full bg-fill">
            <span className="h-full rounded-full bg-accent" style={{ width: `${(r.n / max) * 100}%` }} />
          </span>
          <span className="num text-right text-[11px]">
            {fmt(r.n)}
            {unit}
            {total ? <span className="pl-1 text-muted">{pct(r.n, total)}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Table({ head, rows, align }: { head: string[]; rows: (string | number)[][]; align?: ("l" | "r")[] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-rule">
      <table className="w-full min-w-[504px] text-[12.2px]">
        <thead>
          <tr className="border-b border-rule text-[10.8px] text-muted">
            {head.map((h, i) => (
              <th key={h} className={`px-4 py-2.5 font-semibold ${(align?.[i] ?? (i ? "r" : "l")) === "r" ? "text-right" : "text-left"}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, k) => (
            <tr key={k} className="border-t border-rule first:border-t-0">
              {r.map((c, i) => (
                <td key={i} className={`px-4 py-2.5 ${(align?.[i] ?? (i ? "r" : "l")) === "r" ? "num text-right" : "font-medium"}`}>
                  {typeof c === "number" ? fmt(c) : c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Funnel({ steps }: { steps: FunnelStep[] }) {
  const first = steps[0]?.n ?? 0;
  if (!first) return <Empty text="이 기간에 가입한 사람이 없어요" />;
  return (
    <ol className="flex flex-col rounded-2xl bg-white px-4 py-2 ring-1 ring-rule">
      {steps.map((s, i) => {
        const prev = i ? steps[i - 1]!.n : s.n;
        return (
          <li key={s.key} className="grid grid-cols-[minmax(0,34%)_1fr_auto] items-center gap-3 border-t border-rule py-3 first:border-t-0">
            <span className="text-[12.2px] font-semibold">
              <span className="num pr-1.5 text-muted">{i + 1}</span>
              {s.label}
            </span>
            <span className="flex h-3 overflow-hidden rounded-full bg-fill">
              <span className="h-full rounded-full bg-accent" style={{ width: `${(s.n / first) * 100}%` }} />
            </span>
            <span className="num w-[135px] text-right text-[11px]">
              <b>{fmt(s.n)}</b> <span className="text-muted">{pct(s.n, first, 0)}</span>
              {i ? <span className={`block text-[10.4px] ${prev && s.n < prev ? "text-red" : "text-muted"}`}>{prev ? `앞 단계에서 ${pct(prev - s.n, prev, 0)} 이탈` : "—"}</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** 리텐션 칸 색: 한 색(망고)의 밝음→진함 */
const RAMP = ["#FFFBF0", "#FFF4D6", "#FFE08A", "#FFC23D", "#D99A1E", "#8F5A00"];
function heat(v: number) {
  const i = v <= 0 ? 0 : Math.min(RAMP.length - 1, 1 + Math.floor(v * (RAMP.length - 1)));
  return { background: RAMP[i], color: i >= 4 ? "#FFFFFF" : "#1F2340" };
}

function Login({ wrong }: { wrong: boolean }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[378px] flex-col px-6 pt-[max(calc(var(--sat)+16px),40px)]">
      <Wordmark size={24} />
      <form action={adminLogin} className="flex flex-col gap-3 pt-10">
        <h1 className="headline text-[19.4px]">통계</h1>
        <input name="key" type="password" autoComplete="current-password" aria-label="관리자 키" placeholder="관리자 키" className="field" />
        {wrong ? <p className="text-[12.2px] text-red">키가 맞지 않아요</p> : null}
        <button className="btn-primary">들어가기</button>
      </form>
    </main>
  );
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ wrong?: string; from?: string; to?: string; range?: string; tab?: string }> }) {
  const sp = await searchParams;
  if (!(await isAdmin())) {
    // 관리자 키가 없으면 키 칸도 없다(관리자 계정만 들어온다)
    if (!process.env.ADMIN_KEY) notFound();
    return <Login wrong={!!sp.wrong} />;
  }

  const period = parsePeriod(sp);
  const tab = parseTab(sp.tab);
  const st = await loadStats(period, tab);
  const k = st.kpis;
  const p = st.prev ?? undefined;
  // 탭을 옮겨도 고른 기간은 그대로(직접 고른 날짜면 날짜, 아니면 며칠)
  const keep = sp.from || sp.to ? `&from=${encodeURIComponent(period.from)}&to=${encodeURIComponent(period.to)}` : sp.range ? `&range=${encodeURIComponent(sp.range)}` : "";
  const tabHref = (t: Tab) => `/admin?tab=${t}${keep}`;
  const range = (n: number) => `/admin?tab=${tab}&range=${n}`;
  const isRange = (n: number) => !sp.from && (Number(sp.range) || 30) === n;
  const kv = (f: (x: Kpis) => number) => (k ? f(k) : 0);
  const kp = (f: (x: Kpis) => number) => (p ? f(p) : undefined);
  const visits = st.acquisition?.channels.reduce((a, c) => a + c.visits, 0) ?? 0;
  const giftN = (key: string) => st.features?.find((f) => f.key === key)?.n ?? 0;

  return (
    <main className="min-h-dvh bg-bg pb-20">
      {/* 위: 기간 고르기 + 바로가기(붙어 있다). 앱(웹뷰)에서는 상태 표시줄 높이(--sat)만큼 위를 가림 띠가 덮으니 그 아래에서 시작한다 */}
      <header className="sticky top-0 z-20 border-b border-rule bg-bg/95 backdrop-blur" style={{ paddingTop: "var(--sat)" }}>
        <div className="mx-auto flex max-w-[1008px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <Wordmark size={20} />
            <span className="text-[13.5px] font-bold text-muted">통계</span>
          </div>
          <nav aria-label="기간" className="flex items-center gap-1">
            {[
              [1, "오늘"],
              [7, "7일"],
              [30, "30일"],
              [90, "90일"],
            ].map(([n, l]) => (
              <Link key={n} href={range(n as number)} className={`flex h-9 items-center rounded-full px-3.5 text-[12.2px] font-bold ${isRange(n as number) ? "chip-on" : "bg-white text-ink-2 shadow-[inset_0_0_0_1px_var(--color-edge)]"}`}>
                {l}
              </Link>
            ))}
          </nav>
          <form key={`${period.from}~${period.to}`} action="/admin" className="flex items-center gap-1.5 text-[11.7px]">
            <input type="hidden" name="tab" value={tab} />
            <input type="date" name="from" defaultValue={period.from} aria-label="시작일" className="h-9 rounded-lg bg-white px-2 ring-1 ring-edge" />
            <span className="text-muted">~</span>
            <input type="date" name="to" defaultValue={period.to} aria-label="끝일" className="h-9 rounded-lg bg-white px-2 ring-1 ring-edge" />
            <button className="h-9 rounded-full bg-ink px-3.5 font-bold text-white">보기</button>
          </form>
          <div className="ml-auto flex items-center gap-1">
            <Link href="/home" className="flex h-9 items-center rounded-full bg-white px-3.5 text-[11.7px] font-bold text-accent shadow-[inset_0_0_0_1px_var(--color-edge)]">
              앱으로 이동하기
            </Link>
            <form action={adminLogout}>
              <button className="flex h-9 items-center px-2 text-[11.7px] font-semibold text-muted">나가기</button>
            </form>
          </div>
        </div>
        <nav aria-label="탭" className="mx-auto flex max-w-[1008px] gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:px-8">
          {TABS.map(([id, l]) => (
            <Link key={id} href={tabHref(id)} aria-current={id === tab ? "page" : undefined} className={`flex h-8 shrink-0 items-center rounded-full px-3 text-[11.7px] font-semibold ${id === tab ? "chip-on" : "text-ink-2 hover:bg-white"}`}>
              {l}
            </Link>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-[1008px] px-4 md:px-8">
        <p className="pt-5 text-[11.7px] text-muted">
          {period.from} ~ {period.to} ({period.days}일) · 이전 기간 {period.prevFrom} ~ {period.prevTo}와 견줌 · 데모 계정 제외 · 한국 시간
          {tab === "summary" || tab === "acquisition" || tab === "pages" ? (st.trackingSince ? ` · 화면·유입 기록은 ${st.trackingSince}부터` : " · 화면·유입 기록은 아직 없음") : ""}
        </p>

        <Section id="summary" show={tab === "summary"} title="요약" desc="DAU 평균 = 기간 동안 날마다 들어온 사람 수의 평균. WAU·MAU = 기간 마지막 날까지 7일·30일 동안 한 번이라도 들어온 사람.">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-6">
            <Kpi label="새로 가입" value={fmt(kv((x) => x.signups))} cur={kv((x) => x.signups)} prev={kp((x) => x.signups)} />
            <Kpi label="활성 사용자" value={fmt(kv((x) => x.active))} cur={kv((x) => x.active)} prev={kp((x) => x.active)} />
            <Kpi label="DAU 평균" value={kv((x) => x.avgDau).toFixed(1)} cur={kv((x) => x.avgDau)} prev={kp((x) => x.avgDau)} />
            <Kpi label="WAU" value={fmt(kv((x) => x.wau))} cur={kv((x) => x.wau)} prev={kp((x) => x.wau)} />
            <Kpi label="MAU" value={fmt(kv((x) => x.mau))} cur={kv((x) => x.mau)} prev={kp((x) => x.mau)} />
            <Kpi label="고착도(DAU÷MAU)" value={pct(kv((x) => x.avgDau), kv((x) => x.mau))} hint="20% 넘으면 습관이 된 앱" />
            <Kpi label="방문자(기기)" value={fmt(kv((x) => x.visitors))} cur={kv((x) => x.visitors)} prev={kp((x) => x.visitors)} />
            <Kpi label="방문 → 가입" value={pct(kv((x) => x.signups), kv((x) => x.visitors))} hint="새로 가입 ÷ 방문자" />
            <Kpi label="세션" value={fmt(kv((x) => x.sessions))} cur={kv((x) => x.sessions)} prev={kp((x) => x.sessions)} hint="30분 넘게 쉬면 새 세션" />
            <Kpi label="화면 조회" value={fmt(kv((x) => x.pageViews))} cur={kv((x) => x.pageViews)} prev={kp((x) => x.pageViews)} />
            <Kpi label="하루 사용 시간(1인)" value={dur(kv((x) => x.timePerUserDay))} cur={kv((x) => x.timePerUserDay)} prev={kp((x) => x.timePerUserDay)} hint="화면을 보고 있던 시간" />
            <Kpi label="쿠팡 링크 누름" value={fmt(kv((x) => x.giftClicks))} cur={kv((x) => x.giftClicks)} prev={kp((x) => x.giftClicks)} />
          </div>
        </Section>

        <Section id="trend" show={tab === "summary"} title="추이" desc="대면 그날 숫자가 보여요.">
          {st.daily ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <LineChart title="날마다 활성 사용자(DAU)" unit="명" data={st.daily.map((d) => ({ day: d.day, n: d.dau }))} />
              <LineChart title="날마다 새로 가입" unit="명" data={st.daily.map((d) => ({ day: d.day, n: d.signups }))} />
              <LineChart title="날마다 방문자(기기)" unit="명" data={st.daily.map((d) => ({ day: d.day, n: d.visitors }))} />
              <LineChart title="날마다 화면 조회" unit="번" data={st.daily.map((d) => ({ day: d.day, n: d.pageViews }))} />
            </div>
          ) : (
            <Empty />
          )}
        </Section>

        <Section id="acquisition" show={tab === "acquisition"} title="유입" desc="방문의 첫 화면에서 어디서 왔는지(utm_source → 인앱 브라우저 → 들어온 사이트 → 없으면 직접). 가입 = 그 기기로 처음 온 경로 기준.">
          <Table
            head={["유입 경로", "방문", "방문자", "가입", "가입 전환", "방문 비중"]}
            rows={(st.acquisition?.channels ?? []).map((c) => [CHANNEL_LABEL[c.source] ?? `utm · ${c.source}`, c.visits, c.visitors, c.signups, pct(c.signups, c.visitors), pct(c.visits, visits)])}
          />
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">들어온 사이트</h3>
              <Bars rows={(st.acquisition?.refs ?? []).map((r) => ({ label: r.key, n: r.n }))} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">캠페인(utm_campaign)</h3>
              <Bars rows={(st.acquisition?.campaigns ?? []).map((r) => ({ label: r.key, n: r.n }))} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">처음 들어온 화면</h3>
              <Bars rows={(st.acquisition?.landings ?? []).map((r) => ({ label: pageLabel(r.key), n: r.n }))} />
            </div>
          </div>
        </Section>

        <Section id="funnel" show={tab === "funnel"} title="가입 퍼널" desc="이 기간에 가입한 사람이 각 단계까지 갔는지. 빨간 숫자 = 앞 단계에서 떨어진 비율.">
          {st.funnel ? (
            <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
              <Funnel steps={st.funnel.steps} />
              <div className="flex flex-col gap-2">
                <h3 className="text-[11.7px] font-bold">온보딩 단계별</h3>
                <Funnel steps={st.funnel.onboarding} />
                <h3 className="pt-2 text-[11.7px] font-bold">체험(말로·글로 적기 → 물어보기)에서 한 것</h3>
                <p className="text-[11.3px] text-muted">이 기간에 가입한 사람 중 해당하는 사람 수. 마침 = 링크를 만들고 시작하기를 누른 사람</p>
                <Bars
                  rows={[
                    { label: "말로 적음", n: st.funnel.tour.byVoice },
                    { label: "글로 적음", n: st.funnel.tour.byText },
                    { label: "적기 실패", n: st.funnel.tour.failed },
                    { label: "적기에서 건너뜀", n: st.funnel.tour.skipVoice },
                    { label: "물어보기에서 건너뜀", n: st.funnel.tour.skipAsk },
                  ]}
                />
              </div>
            </div>
          ) : (
            <Empty />
          )}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">이탈한 사람이 마지막으로 본 화면</h3>
              <p className="text-[11.3px] text-muted">
                기간 끝 기준 7일 넘게 안 온 사람 {fmt(st.churn?.churned ?? 0)}명 / 기록된 {fmt(st.churn?.tracked ?? 0)}명
              </p>
              <Bars rows={(st.churn?.lastPages ?? []).map((r) => ({ label: pageLabel(r.path), n: r.n }))} total={st.churn?.lastPages.reduce((a, r) => a + r.n, 0)} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">방문을 끝낸 화면(이 기간)</h3>
              <p className="text-[11.3px] text-muted">세션의 마지막 화면. 나간 비율 = 그 화면에서 끝난 세션 ÷ 그 화면 조회</p>
              <Bars rows={(st.pages ?? []).filter((r) => r.exits).sort((a, b) => b.exits - a.exits).slice(0, 10).map((r) => ({ label: pageLabel(r.path), n: r.exits, sub: `나간 비율 ${pct(r.exits, r.views, 0)}` }))} />
            </div>
          </div>
        </Section>

        <Section id="retention" show={tab === "retention"} title="리텐션" desc="가입하고 N일 뒤 그날 다시 들어온 비율(그날이 지난 사람만). 아래는 주별 가입 묶음이 몇 주 뒤에도 들어왔는지.">
          <div className="grid grid-cols-3 gap-2.5">
            {(st.retention?.day ?? [1, 7, 30].map((n) => ({ n, eligible: 0, back: 0 }))).map((d) => (
              <Kpi key={d.n} label={`${d.n}일 뒤 다시 옴`} value={pct(d.back, d.eligible)} hint={`${fmt(d.back)} / ${fmt(d.eligible)}명`} />
            ))}
          </div>
          {st.retention?.cohorts.length ? (
            <div className="overflow-x-auto rounded-2xl bg-white ring-1 ring-rule">
              <table className="w-full min-w-[576px] text-[11.7px]">
                <thead>
                  <tr className="text-[10.8px] text-muted">
                    <th className="px-3 py-2.5 text-left font-semibold">가입 주</th>
                    <th className="px-3 py-2.5 text-right font-semibold">가입</th>
                    {Array.from({ length: 7 }, (_, i) => (
                      <th key={i} className="px-1 py-2.5 text-center font-semibold">
                        {i + 1}주 뒤
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {st.retention.cohorts.map((c) => (
                    <tr key={c.week} className="border-t border-rule">
                      <td className="px-3 py-1.5 font-medium">{c.week.slice(5).replace("-", "/")} 주</td>
                      <td className="num px-3 py-1.5 text-right">{fmt(c.size)}</td>
                      {c.weeks.map((v, i) => (
                        <td key={i} className="px-1 py-1">
                          {v == null ? (
                            <span className="block h-8" />
                          ) : (
                            <span className="num flex h-8 items-center justify-center rounded-md text-[10.6px] font-semibold" style={heat(v)} title={`${c.week} 가입, ${i + 1}주 뒤 ${pct(v, 1)}`}>
                              {pct(v, 1, 0)}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty text="기간 앞 8주 동안 가입한 사람이 없어요" />
          )}
        </Section>

        <Section id="pages" show={tab === "pages"} title="화면별" desc="조회 = 화면을 연 횟수. 평균 머문 시간 = 그 화면을 보고 있던 시간 합 ÷ 조회(앱을 내리거나 탭을 숨기면 안 셈).">
          <Table
            head={["화면", "조회", "사람", "평균 머문 시간", "머문 시간 합", "나간 비율"]}
            rows={(st.pages ?? []).map((r) => [pageLabel(r.path), r.views, r.users, dur(r.views ? r.totalMs / r.views : 0), dur(r.totalMs), pct(r.exits, r.views, 0)])}
          />
          <div className="flex flex-col gap-2">
            <h3 className="text-[11.7px] font-bold">가장 오래 머문 화면(평균, 조회 3번 넘은 것)</h3>
            <Bars
              rows={(st.pages ?? [])
                .filter((r) => r.views >= 3 && r.totalMs)
                .map((r) => ({ label: pageLabel(r.path), n: Math.round(r.totalMs / r.views / 1000) }))
                .sort((a, b) => b.n - a.n)
                .slice(0, 10)}
              unit="초"
            />
          </div>
        </Section>

        <Section id="features" show={tab === "features"} title="기능별 사용" desc="서버에서 기능이 실제로 끝났을 때 남긴 기록. 사람 = 그 기능을 한 번이라도 쓴 사람(로그인 전은 기기).">
          <Table
            head={["기능", "횟수", "사람", "1인당"]}
            rows={(st.features ?? []).map((f) => [FEATURE_LABEL[f.key] ?? f.key, f.n, f.users, f.users ? (f.n / f.users).toFixed(1) : "—"])}
          />
        </Section>

        <Section id="devices" show={tab === "devices"} title="기기" desc="활성 사용자가 쓴 곳(앱·웹)과 방문 기기 OS·브라우저(카카오톡·인스타 같은 앱 안 브라우저 포함).">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">앱 · 웹(활성 사용자)</h3>
              <Bars rows={(st.devices?.platforms ?? []).map((r: CountRow) => ({ label: PLATFORM_LABEL[r.key] ?? r.key, n: r.users }))} total={(st.devices?.platforms ?? []).reduce((a, r) => a + r.users, 0)} unit="명" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">OS(방문자)</h3>
              <Bars rows={(st.devices?.os ?? []).map((r) => ({ label: OS_LABEL[r.key] ?? r.key, n: r.users }))} total={(st.devices?.os ?? []).reduce((a, r) => a + r.users, 0)} unit="명" />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">브라우저(방문자)</h3>
              <Bars rows={(st.devices?.browsers ?? []).map((r) => ({ label: BROWSER_LABEL[r.key] ?? r.key, n: r.users }))} total={(st.devices?.browsers ?? []).reduce((a, r) => a + r.users, 0)} unit="명" />
            </div>
          </div>
        </Section>

        <Section id="gifts" show={tab === "gifts"} title="선물" desc="선물 추천 봄 → 쿠팡 링크 누름 → 가족 카드 보냄·열림 → 선물 완료. 수익은 쿠팡 파트너스 리포트에서.">
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-6">
            <Kpi label="선물 추천 봄" value={fmt(giftN("gift_picks_view"))} />
            <Kpi label="다시 고르기" value={fmt(giftN("gift_reroll"))} />
            <Kpi label="쿠팡 링크 누름" value={fmt(giftN("gift_click"))} hint={`추천 봄 대비 ${pct(giftN("gift_click"), giftN("gift_picks_view"))}`} />
            <Kpi label="가족 카드 보냄" value={fmt(giftN("card_share"))} />
            <Kpi label="가족 카드 열림" value={fmt(giftN("card_open"))} hint={`보냄 대비 ${pct(giftN("card_open"), giftN("card_share"))}`} />
            <Kpi label="선물 완료" value={fmt(giftN("gift_done"))} />
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">많이 누른 선물</h3>
              <Bars rows={(st.gifts?.topItems ?? []).map((r) => ({ label: CATALOG_BY_ID.get(r.key)?.q ?? r.key, n: r.n, sub: BAND_LABEL[CATALOG_BY_ID.get(r.key)?.band ?? ""] }))} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">가격대별 누름</h3>
              <Bars rows={["1", "3", "5", "10"].map((b) => ({ label: BAND_LABEL[b]!, n: st.gifts?.byBand.find((r) => r.key === b)?.n ?? 0 })).filter((r) => r.n)} total={giftN("gift_click")} />
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-[11.7px] font-bold">어디서 눌렀나</h3>
              <Bars rows={(st.gifts?.bySource ?? []).map((r) => ({ label: SOURCE_LABEL[r.key] ?? r.key, n: r.n }))} total={giftN("gift_click")} />
            </div>
          </div>
        </Section>

        <Section id="totals" show={tab === "totals"} title="누적(기간과 상관없이 지금까지)">
          {st.totals ? (
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 lg:grid-cols-6">
              <Kpi label="가입" value={fmt(st.totals.real)} hint={`온보딩 끝 ${fmt(st.totals.onboarded)}명`} />
              <Kpi label="데모로 둘러보기" value={fmt(st.totals.demo)} />
              <Kpi label="적어 둔 사람" value={fmt(st.totals.contacts)} hint={st.totals.real ? `1인당 ${(st.totals.contacts / st.totals.real).toFixed(1)}명` : undefined} />
              <Kpi label="메모" value={fmt(st.totals.notes)} />
              <Kpi label="물어보기" value={fmt(st.totals.asks)} hint={`답 받음 ${fmt(st.totals.answered)} (${pct(st.totals.answered, st.totals.asks, 0)})`} />
              <Kpi label="앱 알림 켬" value={fmt(st.totals.installs.reduce((a, i) => a + i.n, 0))} hint={st.totals.installs.map((i) => `${PLATFORM_LABEL[i.platform] ?? i.platform} ${i.n}`).join(" · ") || undefined} />
            </div>
          ) : (
            <Empty />
          )}
          <ul className="grid gap-2 pt-2 text-[12.2px] font-semibold md:grid-cols-3">
            {[
              ["https://partners.coupang.com/#affiliate/ws/report/trend/daily", "쿠팡 파트너스 리포트(구매·수수료)"],
              ["https://vercel.com/madoriks-projects/readme/analytics", "Vercel 웹 분석(방문·국가·페이지)"],
              ["https://analytics.google.com/", "GA4(넣었다면)"],
              ["https://tagmanager.google.com/", "GTM(넣었다면)"],
              ["https://search.google.com/search-console", "구글 서치 콘솔(검색 노출)"],
              ["https://searchadvisor.naver.com/", "네이버 서치어드바이저(검색 노출)"],
            ].map(([href, l]) => (
              <li key={href}>
                <a href={href} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center rounded-xl bg-white px-4 text-accent ring-1 ring-rule">
                  {l}
                </a>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}
