import { BRAND, QUESTIONS, askMinutes, translate, type DailyQuestion, type Locale, type Section } from "@readme/core";
import type { Metadata } from "next";

// 링크 미리보기(카카오톡·문자·메신저): 제목·설명·이미지(public/og-v2.png, 1200×630)
// 카카오톡 같은 곳은 같은 주소의 사진을 오래(며칠~몇 주) 기억해서, 같은 파일 이름으로 그림만 바꾸면 예전 그림이 계속 보인다.
// 그래서 그림을 바꿀 때는 파일 이름도 올린다(og-v2 → og-v3). 이 줄·public 파일·apps/mobile/scripts/make-assets.mjs의 출력 경로·proxy.ts의 matcher(og-vN.png)를 같이 고친다.
// 예전 /og.png는 이미 미리보기를 만든 링크가 다시 가져갈 수 있어 그대로 둔다.
export const OG_IMAGE = { url: "/og-v2.png", width: 1200, height: 630 };

/** 링크 미리보기 언어: 미리보기 수집기는 언어를 안 보낼 때가 많아, 보낸 사람 이름에 한글이 있으면 한국어로 */
export function previewLocale(locale: Locale, name: string | undefined): Locale {
  return name && /[가-힣]/.test(name) ? "ko" : locale;
}

export function siteDescription(locale: Locale): string {
  return locale === "ko" ? "가까운 사람끼리 취향, 못 먹는 음식, 사이즈, 생일을 나누는 컨닝페이퍼" : "A cheat sheet of favorites, food restrictions, sizes and birthdays, shared only with the people closest to you";
}

/** 화면마다 openGraph를 통째로 다시 적어야 이미지가 빠지지 않는다(Next는 openGraph를 얕게 합친다) */
export function ogMetadata(locale: Locale, title: string, description = siteDescription(locale)): Metadata {
  return {
    title,
    description,
    openGraph: { type: "website", siteName: BRAND[locale].name, title, description, locale: locale === "ko" ? "ko_KR" : "en_US", images: [{ ...OG_IMAGE, alt: BRAND[locale].title }] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE.url] },
  };
}

/**
 * 물어보기 링크(/r/<토큰>)를 메신저에 붙였을 때 보이는 제목·설명. 제목은 보낸 사람 말투로("○○님이 궁금해해요"), 설명은 이 링크가 무엇을 묻는지("로그인 없이 3가지, 1분이면 돼요", 한 질문이면 그 질문 자체).
 * /r/<토큰>의 링크 미리보기(generateMetadata)와 물어보기 화면의 '이렇게 받아요' 미리보기가 같이 쓴다. from은 보낸 사람 이름(없으면 undefined)
 */
export function requestPreview(locale: Locale, from: string | undefined, ask: { question: DailyQuestion["id"] | null; sections: Section[] }): { lang: Locale; title: string; description: string } {
  const lang = previewLocale(locale, from);
  const title = from ? translate(lang, "og.requestTitle", { name: from }) : translate(lang, "request.title");
  const asked = QUESTIONS.find((x) => x.id === ask.question);
  const description = asked ? asked.prompt[lang] : ask.sections.length ? translate(lang, "og.requestDesc", { n: ask.sections.length, min: askMinutes(ask.sections) }) : siteDescription(lang);
  return { lang, title, description };
}
