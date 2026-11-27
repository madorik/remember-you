"use server";

import { aiConfigured, transcribeImage, type ImageTranscript } from "@/lib/ai";
import { imageRejection, tidyTranscript, type ImageReject } from "@/lib/capture-ai";
import { refundAi, reserveAi } from "@/lib/ai-quota";
import { requireSession } from "@/lib/data";
import { jpegDataUrls } from "@/lib/image-form";
import { track } from "@/lib/track";

/** 사진에서 글 옮기기가 실패한 이유 */
export type PhotoTextError = ImageReject | "bad_image" | "limit" | "failed" | "ai_off";

export interface PhotoTextResult {
  /** 옮긴 글(줄바꿈 그대로). 실패하면 빈 글 */
  text: string;
  error: PhotoTextError | null;
  /** 읽지 못해 건너뛴 사진 수 */
  skipped: number;
}

/**
 * 메모 쓰기 화면의 '사진에서' — 글자만 옮긴다(기록으로 정리하지 않고 아무것도 저장하지 않는다): 폰에서 줄여 JPEG로 다시 만든 사진 한 장 이상 세 장까지를
 * 파일(FormData의 image)로 받아, AI가 사진 속 메모 글을 그대로 읽어 돌려준다. 사진이 둘 이상이면 읽은 글을 빈 줄 하나로 잇는다.
 * - AI에 보내기 전에 사진마다 서버가 한 번 더 확인한다(jpegDataUrls). 하나라도 걸리면 한도를 쓰지 않고 bad_image
 * - 메모·대화·문서가 아니거나(풍경·신분증·카드…) 글씨를 못 읽는 사진은 글을 돌려주지 않는다. 읽은 글은 전화번호·이메일·링크·주민번호 모양이 든 줄을 서버가 한 번 더 걸러 낸다
 * - 한도는 메모 가져오기와 같이 쓴다(하루 5번, 'import'). 한 장이라도 불러 보지 못했으면 통째로 실패로 하고 한도를 돌려준다. 답을 받은 뒤의 거절은 비용이 났으니 돌려주지 않는다
 * - 사진은 저장하지 않고 AI에만 보낸다(store:false). 글 내용은 기록에 남기지 않는다
 */
export async function transcribeMemoImages(form: FormData): Promise<PhotoTextResult> {
  const s = await requireSession();
  const none = (error: PhotoTextError, skipped = 0): PhotoTextResult => ({ text: "", error, skipped });
  const photos = await jpegDataUrls(form);
  if (!photos) return none("bad_image");
  if (!aiConfigured()) return none("ai_off");
  const gate = await reserveAi({ id: s.user.id, demo: s.user.isAnonymous || s.profile.isDemo }, "import");
  if (gate === "user_limit" || gate === "global_limit") return none("limit");
  if (gate !== "ok") return none("failed");
  const settled = await Promise.allSettled(photos.map((url) => transcribeImage(url, s.profile.locale)));
  if (settled.some((r) => r.status === "rejected")) {
    // 불러 보지도 못하고 실패했으니 하루 한도는 돌려준다. 글·사진은 남기지 않고 이유만
    const why = (settled.find((r) => r.status === "rejected") as PromiseRejectedResult).reason;
    console.error("[transcribe] ai request failed", { message: why instanceof Error ? why.message : String(why) });
    await refundAi(s.user.id, "import");
    return none("failed");
  }
  const readings = settled.map((r) => (r as PromiseFulfilledResult<ImageTranscript>).value);
  track("import_draft", { userId: s.user.id, source: "photo" });
  const texts = readings.filter((r) => r.accepted).map((r) => tidyTranscript(r.text)).filter(Boolean);
  const skipped = photos.length - texts.length;
  if (!texts.length) return none(imageRejection(readings.map((r) => (r.accepted ? "unreadable" : r.kind))), skipped);
  return { text: tidyTranscript(texts.join("\n\n")), error: null, skipped };
}
