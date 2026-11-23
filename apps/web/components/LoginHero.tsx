import { type AvatarConfig, type Locale, sanitizeAvatar } from "@readme/core";
import Link from "next/link";
import type { T } from "@/lib/i18n";
import { Avatar } from "./Avatar";
import { Heart } from "./diary";
import { TornTape } from "./TornTape";
import { Icon } from "./marks";
import { Mascot } from "./Mascot";

// 로그인 그림: 망고 해 앞에 컨닝페이퍼 한 장(꼭 기억할 것 세 줄, 데모 샘플 사람들과 같은 이야기), 옆에서 하트 든 캐릭터가 같이 본다

// 데모 샘플(lib/demo.ts)과 같은 얼굴
const MOM = sanitizeAvatar({ hair: "perm", face: "round", body: "cardigan", item: "earrings", bg: "rose", cloth: "#E7D3B0", hairColor: "#5A4334", skin: "#FFF1E6" });
const BESTIE = sanitizeAvatar({ hair: "pony", face: "oval", body: "zip", item: "cap", bg: "water", cloth: "#34B36A", hairColor: "#D9A15B" });
const WIFE = sanitizeAvatar({ hair: "wave", face: "vline", body: "turtle", item: "necklace", bg: "sky", cloth: "#FF9DB0", hairColor: "#1F2340" });

function Row({ face, who, children, first }: { face: AvatarConfig; who: string; children: React.ReactNode; first?: boolean }) {
  return (
    <div className={`flex items-center gap-2.5 py-[9.9px] ${first ? "" : "border-t border-dashed border-ink/30"}`}>
      <Avatar config={face} size={27} label={who} />
      <span className="w-[30.6px] shrink-0 text-[10.8px] leading-none text-muted">{who}</span>
      <span className="hand-written min-w-0 text-[18.6px] leading-[1.15]">{children}</span>
    </div>
  );
}

/**
 * 로그인 그림(시안): 망고빛 해 앞에 컨닝페이퍼 카드 한 장(꼭 기억할 것 세 줄), 왼쪽에서 하트 든 캐릭터가 같이 본다.
 * 카드는 흰 바탕 + 남색 선 + 모서리 18, 위에 분홍 테이프
 */
export function LoginHero({ t }: { t: T }) {
  return (
    <div aria-hidden="true" className="relative mx-auto h-[199.8px] w-full max-w-[307.8px] select-none">
      <div className="login-sun absolute right-0 top-0 h-[108px] w-[108px] rounded-full bg-[#ffe29a]" />

      <div className="login-paper left-[26.1px] top-[20.7px] w-[270px] rounded-[16.2px] border border-edge bg-white px-[16.2px] pb-1 pt-3.5" style={{ "--tilt": "2deg", animationDelay: "0.35s" } as React.CSSProperties}>
        <TornTape color="pink" w={71} h={23} rotate={-3} className="-top-3 left-[111.6px]" />
        <span className="hand flex items-center gap-1.5 pb-2 text-[19.4px] leading-[1.1]">
          <Heart size={22} inline />
          {t("login.paperTitle")}
        </span>
        <div className="flex flex-col border-t border-dashed border-ink/30">
          <Row face={MOM} who={t("login.noteMom")} first>
            {t("login.noteFlower")}
          </Row>
          <Row face={BESTIE} who={t("login.noteFriend")}>
            <span className="flex items-center gap-1 text-red">
              <Icon name="alert" size={18} strokeWidth={2} className="shrink-0" />
              {t("login.noteAllergy")}
            </span>
          </Row>
          <Row face={WIFE} who={t("login.noteWife")}>
            {t("login.noteCake")}
          </Row>
        </div>
      </div>

      <div className="login-pop absolute -left-[18.9px] top-[66.6px]" style={{ animationDelay: "0.15s" }}>
        <Mascot pose={4} size={72} />
      </div>
    </div>
  );
}

/** 시작·로그인 화면 아래 약관 · 개인정보 처리방침 · 선물 가이드(시안: 작고 흐린 글, 가운데 점으로 이음) */
export function StartLegal({ locale }: { locale: Locale }) {
  const link = "inline-flex min-h-11 items-center";
  return (
    <p className="flex flex-wrap items-center justify-center pt-1 text-[10.8px] text-muted">
      <a href={`/terms?lang=${locale}`} className={link}>
        {locale === "ko" ? "이용약관" : "Terms"}
      </a>
      <span aria-hidden="true" className="px-1.5">
        ·
      </span>
      <a href={`/privacy-policy?lang=${locale}`} className={link}>
        {locale === "ko" ? "개인정보 처리방침" : "Privacy Policy"}
      </a>
      {locale === "ko" ? (
        <>
          <span aria-hidden="true" className="px-1.5">
            ·
          </span>
          <Link href="/gifts" className={link}>
            선물 가이드
          </Link>
        </>
      ) : null}
    </p>
  );
}

/** 시작·로그인 화면 제목: *별표* 사이 낱말에 형광펜(컨닝페이퍼) */
export function HeroHeadline({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split("*");
  return (
    <h1 className={`hero-rise headline whitespace-pre-line text-[34.8px] leading-[1.15] ${className}`} style={{ animationDelay: "0.2s" }}>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="hl">
            {p}
          </span>
        ) : (
          p
        ),
      )}
    </h1>
  );
}
