import type { AvatarConfig } from "@readme/core";
import Link from "@/components/AppLink";
import { Avatar } from "@/components/Avatar";
import { FaceStack } from "@/components/FaceStack";
import { Mascot } from "@/components/Mascot";
import { u } from "@/lib/ui-scale";

// 홈(챙길 날) 시안 'H-Home'의 조각: 날짜 머리 · 다가오는 날 카드 틀(줄무늬 테이프·D-n 도장·폴라로이드·분홍 상자·망고 단추) · 이번 주 카드.
// 크기는 시안 px의 90%(앱 전체 배율)로 적어 둔다. 서버·클라이언트 어디서나 쓴다(훅 없음). 장식은 aria-hidden.

const INK = "#1F2340";
const MANGO = "#FFC23D";
const MANGO_RING = "#E0A32E";
const STAMP_TEXT = "#A8481A";
const EDGE = "rgba(31,35,64,.28)";
const DASH = "rgba(31,35,64,.3)";
const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.4A4 4 0 0 1 19 10c0 5.6-7 10-7 10z";
const STAR = "M12 2.8l2.6 5.6 6.1.8-4.5 4.2 1.1 6-5.3-3-5.3 3 1.1-6-4.5-4.2 6.1-.8z";

/** 가는 선 하트(분홍·붉은). 폴라로이드 이름 옆·이번 주 얼굴 옆에 */
export function SmallHeart({ size = 13, fill = "#E8627C", className = "", style }: { size?: number; fill?: string; className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={u(size)} height={u(size)} className={`shrink-0 ${className}`} style={style}>
      <path d={HEART} fill={fill} stroke={INK} strokeOpacity=".55" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** 망고 별 낙서 */
function MangoStar({ size, className = "", style }: { size: number; className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={u(size)} height={u(size)} className={`pointer-events-none absolute ${className}`} style={style}>
      <path d={STAR} fill={MANGO} stroke={INK} strokeOpacity=".55" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

/** 손으로 두른 망고 동그라미(오늘). 부모는 relative. 둘레 크기는 부모 글자 칸에 맞춰 가운데에 놓는다 */
function MangoRing({ w, h, vb, d, className = "" }: { w: number; h: number; vb: string; d: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox={vb} width={u(w)} height={u(h)} fill="none" stroke={MANGO} strokeWidth="2.6" strokeLinecap="round" className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}>
      <path d={d} />
    </svg>
  );
}
const RING_WEEKDAY = "M7 19 C4 9 14 3 23 4 C33 5 38 12 36 20 C33 29 22 32 14 29 C8 27 6 21 8 14";
const RING_DATE = "M8 21 C5 10 16 3 26 4 C37 5 42 13 40 22 C37 32 25 36 16 32 C9 29 7 23 9 16";

const WEEKDAY_COLOR = (wd: number) => (wd === 0 ? "#C8283A" : wd === 6 ? "#2F5FC4" : "#5B5F78");

/** 날짜 머리: 작은 줄(년 · 음력) + 큰 오늘 날짜(h1, 별 낙서) + 오른쪽 요일 글자(월~일, 오늘은 동그라미) + 손으로 그은 남색 줄 */
export function DateHead({ small, big, todayWd, names, label }: { small: string; big: string; todayWd: number; names: string[]; label: string }) {
  return (
    <section aria-label={label} className="relative shrink-0 pl-[19.8px] pr-[18px] pt-[2.7px]">
      <span className="text-[12.6px] text-muted">{small}</span>
      <div className="mt-[3.6px] flex items-end justify-between">
        <h1 className="hand relative text-[38.7px] leading-none">
          {big}
          <MangoStar size={24} className="-right-[30.6px] top-[3.6px]" />
        </h1>
        <div aria-hidden="true" className="mb-[2.7px] flex gap-[0.9px]">
          {[1, 2, 3, 4, 5, 6, 0].map((wd) => (
            <span key={wd} className="hand relative flex h-[27px] w-[23.4px] items-center justify-center text-[18.9px] leading-none" style={{ color: wd === todayWd ? INK : WEEKDAY_COLOR(wd) }}>
              {wd === todayWd ? <MangoRing w={34} h={31} vb="0 0 40 36" d={RING_WEEKDAY} /> : null}
              {names[wd]}
            </span>
          ))}
        </div>
      </div>
      <svg aria-hidden="true" viewBox="0 0 360 10" width="100%" height={u(10)} preserveAspectRatio="none" fill="none" stroke={INK} strokeOpacity=".7" strokeWidth="1.8" strokeLinecap="round" className="mt-[9px] block">
        <path d="M2 6 C60 3 120 7 180 5 S300 3 358 6" vectorEffect="non-scaling-stroke" />
      </svg>
    </section>
  );
}

/** 카드 윗변 가운데에 붙인 줄무늬 망고 테이프 */
function MangoTape() {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 -top-[13.5px] -ml-[57.6px] h-[27px] w-[115.2px] rounded-[1.8px] opacity-[.92]"
      style={{ transform: "rotate(-3deg)", background: "repeating-linear-gradient(-45deg, #FFD978 0 8.1px, #FFE9A8 8.1px 16.2px)" }}
    />
  );
}

/** D-n 도장: 망고 이중 고리, 남색 손글씨, 살짝 기울임. big은 'D-6'·'오늘' */
export function DStamp({ children, fontSize }: { children: React.ReactNode; fontSize: number }) {
  return (
    <span
      aria-hidden="true"
      className="hand flex shrink-0 items-center justify-center rounded-full leading-none"
      style={{
        width: u(62),
        height: u(62),
        boxSizing: "border-box",
        border: `${u(2.2)}px solid ${MANGO_RING}`,
        boxShadow: `inset 0 0 0 ${u(2.4)}px #FFFFFF, inset 0 0 0 ${u(3.6)}px ${MANGO_RING}`,
        color: INK,
        transform: "rotate(-9deg)",
        fontSize: u(fontSize * 0.8),
      }}
    >
      {children}
    </span>
  );
}

/** 폴라로이드: 흰 틀 + 연한 망고 사진 칸 + 이름 줄(하트). 틀만 기울인다 */
export function HeroPolaroid({ children, caption, heart = true }: { children: React.ReactNode; caption?: React.ReactNode; heart?: boolean }) {
  return (
    <span
      className="flex shrink-0 flex-col items-center border bg-white px-[5.4px] pt-[5.4px]"
      style={{ borderColor: EDGE, boxShadow: "0 5.4px 10.8px -7.2px rgba(31,35,64,.5)", transform: "rotate(-4deg)", paddingBottom: caption ? 4.5 : 5.4 }}
    >
      <span className="flex items-center justify-center" style={{ width: u(70), height: u(70), background: "#FFF4D6" }}>
        {children}
      </span>
      {caption ? (
        <span className="hand mt-[3.6px] flex max-w-[63px] items-center gap-[3.6px] text-[15.3px] leading-none">
          <span className="min-w-0 truncate">{caption}</span>
          {heart ? <SmallHeart size={12} /> : null}
        </span>
      ) : null}
    </span>
  );
}

/** 카드 안 분홍 상자(기억해 둔 것) */
export function RememberedBox({ label, text }: { label: string; text: string }) {
  return (
    <div className="mt-[9px] flex items-baseline gap-[7.2px] rounded-[9px] px-[12.6px] py-[7.2px]" style={{ background: "#FBE1E8" }}>
      <span className="shrink-0 text-[11.7px] text-muted">{label}</span>
      <span className="hand-written min-w-0 flex-1 truncate text-[18px] leading-[1.2]">{text}</span>
    </div>
  );
}

/** 카드 맨 아래 꽉 찬 망고 단추(글자 + 화살표) */
export function HeroButton({ href, label, first = true, small = false }: { href: string; label: string; first?: boolean; small?: boolean }) {
  return (
    <Link
      href={href}
      className={`hand flex h-[44px] items-center justify-center gap-[7.2px] rounded-[14.4px] border leading-none transition-transform active:translate-y-px ${first ? "mt-[10.8px]" : "mt-[7.2px]"} ${small ? "text-[18.9px]" : "text-[21.6px]"}`}
      style={{ borderColor: EDGE, background: MANGO, boxShadow: "0 2.7px 0 #E09A12", color: INK }}
    >
      <span className="min-w-0 truncate">{label}</span>
      <svg aria-hidden="true" viewBox="0 0 24 24" width={u(20)} height={u(20)} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </Link>
  );
}

/**
 * 연말 카드 아래 한 줄을 꽉 채운다: [동그란 얼굴] + 남은 폭 전체의 밑줄 링크 '크리스마스 선물 고르러 가기 ……→'(단추 모양 아님).
 * 글자는 그 사람의 선물 고르기로. 얼굴은 pickHref가 있으면(사람이 여럿) 다른 사람을 고르러 가는 링크(이름은 읽어 주는 이름으로만), 없으면 그냥 그림
 */
const PICK_D = 40;
export function HeroPickRow({ avatar, name, pickHref, giftHref, giftLabel }: { avatar: AvatarConfig | null; name: string; pickHref: string | null; giftHref: string; giftLabel: string }) {
  const ring = "flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white";
  const ringStyle: React.CSSProperties = { width: PICK_D, height: PICK_D, background: "#FFF4D6", boxShadow: `0 0 0 1px ${EDGE}, 0 3.6px 7.2px -5.4px rgba(31,35,64,.5)` };
  const face = <Avatar config={avatar} size={PICK_D - 4} label={name} decorative />;
  return (
    <div className="mt-[10.8px] flex items-center gap-[9px]">
      {pickHref ? (
        <Link href={pickHref} aria-label={name} className={`${ring} relative before:absolute before:-inset-[4px]`} style={ringStyle}>
          {face}
        </Link>
      ) : (
        <span className={ring} style={ringStyle}>
          {face}
        </span>
      )}
      <Link href={giftHref} className="hand flex min-h-11 min-w-0 flex-1 items-center justify-between gap-[5.4px] border-b-[1.8px] pb-[3.6px] text-[21.6px] leading-none" style={{ color: INK, borderColor: "#E09A12" }}>
        <span className="min-w-0 truncate">{giftLabel}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24" width={u(20)} height={u(20)} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </Link>
    </div>
  );
}

/**
 * 다가오는 날 카드 틀: 줄무늬 망고 테이프 · 왼쪽 위 작은 라벨 · 오른쪽 위 도장 · (빼꼼 캐릭터) · 폴라로이드 + 제목·날짜 · 안쪽 줄 · 단추 · 하트·물결 낙서.
 * 큰 카드 변형(연말·명절·새 친구·같은 날 여럿)도 같은 틀에 그림·글·단추를 끼운다
 */
export function HeroFrame({ ariaLabel, label, stamp, art, title, sub, inner, children }: { ariaLabel: string; label: string | null; stamp: React.ReactNode; art: React.ReactNode; title: React.ReactNode; sub?: React.ReactNode; inner?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-label={ariaLabel} className="card relative mx-4 flex shrink-0 flex-col px-[16.2px] pb-[13.5px] pt-[14.4px]">
      <MangoTape />
      <span className="pointer-events-none absolute -top-[34.2px] left-[12.6px]">
        <Mascot pose={2} size={41.4} />
      </span>
      {label || stamp ? (
        <div className="flex items-start justify-between">
          {label ? (
            <span className="hand mt-[5.4px] text-[18.9px] leading-none" style={{ color: STAMP_TEXT }}>
              {label}
            </span>
          ) : (
            <span />
          )}
          {stamp ? <span className="-mb-[5.4px] -mr-[3.6px] -mt-[9px]">{stamp}</span> : null}
        </div>
      ) : null}
      {label ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" width={u(17)} height={u(17)} fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" className="pointer-events-none absolute left-[135px] top-[32.4px]">
          <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
        </svg>
      ) : null}
      <div className={`${label || stamp ? "mt-[1.8px]" : ""} flex items-center gap-[13.5px]`}>
        {art}
        <div className="flex min-w-0 flex-1 flex-col gap-[5.4px]">
          {title}
          {sub ? <span className="text-[13.5px] leading-[1.35] text-muted [word-break:keep-all]">{sub}</span> : null}
        </div>
      </div>
      {inner}
      {children}
      <SmallHeart size={34} fill="#F29BB0" className="pointer-events-none absolute -bottom-[14.4px] -left-[12.6px]" style={{ transform: "rotate(-14deg)" }} />
      <svg aria-hidden="true" viewBox="0 0 70 14" width={u(70)} height={u(14)} fill="none" stroke={MANGO_RING} strokeWidth="2.4" strokeLinecap="round" className="pointer-events-none absolute -bottom-[8.1px] right-[27px]">
        <path d="M2 9 C10 1 16 1 22 7 S34 13 40 7 S54 1 60 7 S66 11 68 8" />
      </svg>
    </section>
  );
}

export interface WeekDay {
  key: string;
  wd: number;
  d: number;
  lunar: string;
  today: boolean;
  /** 공휴일·챙기는 날 이름(짧게)과 쉬는 날 여부 */
  mark: { text: string; off: boolean } | null;
  faces: { key: string; avatar: AvatarConfig | null; label: string }[];
}

/** 이번 주 카드: 제목 + '챙길 날 n번!' 알약 + 달력 단추 + 오늘부터 여덟 칸(요일·날짜·음력·챙길 사람 얼굴) */
export function WeekCard({ title, countText, calendarHref, calendarLabel, names, days }: { title: string; countText: string | null; calendarHref: string; calendarLabel: string; names: string[]; days: WeekDay[] }) {
  return (
    <section aria-label={title} className="card relative mx-4 shrink-0 px-[10.8px] pb-[5.4px] pt-[14.4px] transition-transform active:scale-[0.995]">
      {/* 카드 어디를 눌러도 달력으로(달력 단추는 그 위) */}
      <Link href={calendarHref} tabIndex={-1} aria-hidden="true" className="absolute inset-0 z-10 rounded-[16.2px]" />
      <MangoStar size={20} className="-top-[10.8px] left-[135px]" />
      <span aria-hidden="true" className="pointer-events-none absolute -left-[12.6px] -top-[7.2px] h-[19.8px] w-[54px]" style={{ background: "rgba(249,203,213,.8)", transform: "rotate(-32deg)" }} />
      <div className="flex items-center gap-[10.8px] px-[5.4px]">
        <h2 className="hand text-[25.2px] leading-none">{title}</h2>
        {countText ? (
          <span className="hand inline-flex h-[30.6px] items-center whitespace-nowrap rounded-full border px-[12.6px] text-[17.1px] leading-none" style={{ borderColor: EDGE, background: "#FFF4D6", transform: "rotate(-2deg)" }}>
            {countText}
          </span>
        ) : null}
        <Link href={calendarHref} aria-label={calendarLabel} className="relative z-20 ml-auto flex h-9 w-9 items-center justify-center">
          <svg aria-hidden="true" viewBox="0 0 24 24" width={u(28)} height={u(28)} fill="none" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
            <path d="M3.5 10h17M8 3v4M16 3v4" />
          </svg>
        </Link>
      </div>
      <ol className="mt-[12.6px] grid grid-cols-8">
        {days.map((day, i) => {
          const red = day.wd === 0 || !!day.mark?.off;
          const color = red ? "#C8283A" : day.wd === 6 ? "#2F5FC4" : INK;
          return (
            <li key={day.key} aria-current={day.today ? "date" : undefined} className={`flex min-w-0 flex-col items-center pb-[7.2px] pt-[1.8px] ${i ? "border-l border-dashed" : ""}`} style={i ? { borderColor: DASH } : undefined}>
              <span className="text-[12.6px]" style={{ color: WEEKDAY_COLOR(day.wd) }}>
                {names[day.wd]}
              </span>
              <span className="hand relative mt-[7.2px] flex h-[32.4px] w-[32.4px] items-center justify-center text-[23.4px] leading-none" style={{ color }}>
                {day.today ? <MangoRing w={40} h={36} vb="0 0 44 40" d={RING_DATE} /> : null}
                {day.d}
              </span>
              <span className="mt-[1.8px] text-[9.9px] text-muted">{day.lunar}</span>
              {day.mark ? (
                <span className="mt-px max-w-full truncate px-px text-[8.1px] leading-[1.2]" style={{ color: day.mark.off ? "#C8283A" : "#5B5F78" }}>
                  {day.mark.text}
                </span>
              ) : null}
              {day.faces.length ? (
                <span className="relative mt-[5.4px] flex">
                  <FaceStack faces={day.faces} size={day.faces.length > 1 ? 24 : 30} />
                  <SmallHeart size={13} className="absolute -right-[5.4px] -top-[5.4px]" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-[9px] -right-[10.8px] h-[19.8px] w-[57.6px]" style={{ background: "rgba(205,235,221,.9)", transform: "rotate(-28deg)" }} />
    </section>
  );
}
