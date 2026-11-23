"use client";

import type { AvatarConfig, Locale } from "@readme/core";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { useT } from "@/components/editors/shared";
import { Icon } from "@/components/marks";
import { ReplyAlert } from "@/components/ReplyAlert";
import { canShare, copyText, isPhone, shareLink } from "@/components/ShareButtons";
import { Sheet } from "@/components/Sheet";

const BTN = "hand inline-flex h-[48px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border border-edge px-3 text-[18px]";

/**
 * 물어보기 공유 팝업: 브라우저·앱 공유창을 못 열 때(PC·누른 지 오래돼 막힘·복사가 막힘) 화면은 그대로 두고 아래에서 올라온다.
 * 링크 복사 · 문자로 보내기(휴대폰만) · 공유하기(공유창이 있을 때), 맨 아래에 답장 알림 한 줄. 링크 글자는 보이지 않는다
 */
export function AskShareSheet({
  locale,
  name,
  face,
  link,
  webPushKey,
  onClose,
  onShared,
}: {
  locale: Locale;
  name: string;
  face: AvatarConfig | null;
  link: { url: string; text: string };
  webPushKey: string | null;
  onClose: () => void;
  /** 공유창으로 보냈다(팝업을 닫고 화면에서 '물어봤어요'를 알린다) */
  onShared: () => void;
}) {
  const t = useT(locale);
  // 이 팝업은 누른 뒤에야 그려지므로 기기를 바로 읽어도 서버 화면과 어긋나지 않는다
  const [os] = useState(() => canShare());
  const [phone] = useState(() => isPhone());
  const [copied, setCopied] = useState<"ok" | "failed" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const body = `${link.text}\n${link.url}`;

  const copy = async () => {
    setCopied((await copyText(body)) ? "ok" : "failed");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 2200);
  };
  const share = async () => {
    // 이 단추를 눌러 바로 부르는 거라 브라우저가 허락한다
    if ((await shareLink(link.text, link.url)) === "shared") onShared();
  };

  const first = os ? "share" : "copy";
  const tone = (k: "share" | "copy" | "sms") => (k === first ? "bg-sky" : "bg-white");

  return (
    <Sheet
      id="ask-share-sheet"
      title={t("request.titleTo", { name })}
      icon={<Avatar config={face} size={30} label={name} decorative />}
      closeLabel={t("common.close")}
      onClose={onClose}
      footer={
        <>
          <div className="flex flex-col gap-2.5 pb-1">
            {os ? (
              <button type="button" onClick={() => void share()} className={`${BTN} ${tone("share")}`}>
                <Icon name="share" size={19} strokeWidth={1.7} />
                {t("request.share")}
              </button>
            ) : null}
            <button type="button" onClick={() => void copy()} className={`${BTN} ${tone("copy")}`}>
              <Icon name={copied === "ok" ? "check" : "copy"} size={19} strokeWidth={1.7} />
              {copied === "ok" ? t("common.copied") : copied === "failed" ? t("common.copyFailed") : t("common.copyLink")}
            </button>
            {phone ? (
              <a href={`sms:?&body=${encodeURIComponent(body)}`} className={`${BTN} ${tone("sms")}`}>
                <Icon name="chat" size={19} strokeWidth={1.7} />
                {t("request.sms")}
              </a>
            ) : null}
          </div>
          <span role="status" className="sr-only">
            {copied === "ok" ? t("common.copied") : copied === "failed" ? t("common.copyFailed") : ""}
          </span>
          <ReplyAlert locale={locale} publicKey={webPushKey} className="mt-1.5" />
        </>
      }
    >
      {null}
    </Sheet>
  );
}
