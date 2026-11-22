"use client";

import { useEffect, useState } from "react";
import { google, send } from "@/components/beacon";
import { isNativeApp } from "@/components/native";
import { EMPTY_REVIEW, noteAsked, noteDay, parseReview, reviewDue, savedFresh, type ReviewState } from "@/lib/review";

// 스토어 리뷰 부탁(앱 안에서만). 아이폰은 앱이 만든 별점 창을 막아서 OS가 주는 창(iOS StoreKit·안드로이드 Play 인앱 리뷰)만 쓴다.
// 언제 부를지는 lib/review.ts: 앱을 3일 이상 열어 본 사람에게, 좋은 일이 있은 직후(답장을 확인했을 때·기록을 저장하고 홈에 돌아왔을 때), 90일에 한 번, 평생 3번까지.
// 리뷰 플러그인이 없는 예전 앱(네이티브에 아직 안 들어간 빌드)에서는 호출이 실패하니 아무 일도 없고 '물어봤다'고 적지도 않는다

const KEY = "rm_review";
const SAVED_KEY = "rm_saved";

/** 이번 앱 실행에서 이미 시도했는지(한 번 실패해도 같은 실행에서 다시 두드리지 않는다) */
let tried = false;

function load(): ReviewState {
  try {
    return parseReview(localStorage.getItem(KEY));
  } catch {
    return EMPTY_REVIEW;
  }
}

function save(s: ReviewState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* 저장소를 못 쓰면 적지 못하고 넘어간다 */
  }
}

function localYmd(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 기록을 저장했다고 표시한다(홈으로 돌아와 보이는 순간 리뷰를 부탁하려고). 저장이 끝난 자리에서 부른다 */
export function markSaved(): void {
  try {
    sessionStorage.setItem(SAVED_KEY, String(Date.now()));
  } catch {
    /* 그만 */
  }
}

/** 오늘 앱을 연 날로 적는다(앱 틀에 한 번) */
export function ReviewDays() {
  useEffect(() => {
    if (!isNativeApp()) return;
    save(noteDay(load(), localYmd()));
  }, []);
  return null;
}

/**
 * 좋은 순간에 붙이면 잠깐 뒤 리뷰 창을 부탁한다(그 사이에 화면을 떠나면 하지 않는다).
 * when="saved"는 방금 기록을 저장하고 온 화면에서만(markSaved 표시가 막 남아 있을 때).
 * 좋은 순간인지는 armed로 받되 화면이 열린 때의 값으로 굳힌다: 답장 확인은 화면을 열자마자 읽음 처리로 서버가 화면을 다시 그려
 * (answered가 곧 false가 된다) 조건부로 붙인 컴포넌트는 부탁 전에 사라진다. 그러니 늘 붙여 두고 armed만 넘긴다
 */
export function ReviewMoment({ source, delay, when = "now", armed = true }: { source: "answer" | "saved"; delay: number; when?: "now" | "saved"; armed?: boolean }) {
  const [on] = useState(armed);
  useEffect(() => {
    if (!on || tried || !isNativeApp()) return;
    if (when === "saved") {
      let at = NaN;
      try {
        at = Number(sessionStorage.getItem(SAVED_KEY));
      } catch {
        /* 표시를 못 읽으면 하지 않는다 */
      }
      if (!savedFresh(at, Date.now())) return;
    }
    if (!reviewDue(load(), Date.now())) return;
    const timer = setTimeout(async () => {
      if (tried) return;
      tried = true;
      try {
        sessionStorage.removeItem(SAVED_KEY);
      } catch {
        /* 그만 */
      }
      try {
        const { InAppReview } = await import("@capacitor-community/in-app-review");
        await InAppReview.requestReview();
      } catch {
        // 플러그인이 없는 예전 앱, Play에서 받지 않은 앱 등: 부탁하지 못했으니 적지 않는다
        return;
      }
      save(noteAsked(load(), Date.now()));
      send([{ n: "review_ask", s: source }], true);
      // GTM·GA4에도(태그가 켜져 있을 때만): gift_click·card_share와 같게 같은 이름·from으로
      google("review_ask", { from: source });
    }, delay);
    return () => clearTimeout(timer);
  }, [on, source, delay, when]);
  return null;
}
