"use client";

import type { Locale } from "@readme/core";
import { useState } from "react";
import { Heart, Star, Tape } from "@/components/diary";
import { useT } from "@/components/editors/shared";
import { Icon } from "@/components/marks";
import { ShareButtons } from "@/components/ShareButtons";
import { Sheet } from "@/components/Sheet";
import type { QrShape } from "@/lib/qr";

/**
 * 설정의 '앱 공유하기' 줄: 누르면 시트가 올라와 다운로드 QR(옆 사람이 휴대폰 카메라로 찍는 용)과 보내기·링크 복사 단추를 보여 준다(링크 글자는 보이지 않는다).
 * 링크 하나(/get?from=share)가 보는 사람 기기에 맞는 스토어(아이폰 App Store, 안드로이드 Play)로 이어 준다
 */
export function ShareAppRow({ locale, url, qr }: { locale: Locale; url: string; qr: QrShape }) {
  const t = useT(locale);
  const [open, setOpen] = useState(false);
  const pad = 2;
  const span = qr.size + pad * 2;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-12 w-full items-center gap-3 border-t-[1.5px] border-dashed border-rule text-left">
        <span className="flex-1 pl-1 text-[19px]">{t("privacy.shareApp")}</span>
        <Icon name="share" size={20} className="mr-1 shrink-0 text-muted" />
      </button>
      {open ? (
        <Sheet id="share-app-sheet" title={t("privacy.shareApp")} closeLabel={t("common.close")} onClose={() => setOpen(false)} footer={<ShareButtons locale={locale} url={url} text={t("privacy.shareAppText")} />}>
          <div className="flex flex-col gap-4 px-6 pb-3 pt-2">
            {/* QR은 밝은 바탕에 어두운 점이어야 잘 읽혀서 종이 카드 안에 흰 바탕으로 둔다 */}
            <div className="relative mx-auto mt-2 rounded-[10px] border-[1.5px] border-ink bg-white p-3.5 shadow-[0_6px_16px_rgba(31,35,64,0.12)]">
              <Tape color="mango" w={76} h={22} rotate={-4} alpha={0.7} className="-top-[11px] left-1/2 -ml-[38px]" />
              <svg role="img" aria-label={t("privacy.shareAppQr")} viewBox={`${-pad} ${-pad} ${span} ${span}`} width="208" height="208" shapeRendering="crispEdges" className="block">
                <rect x={-pad} y={-pad} width={span} height={span} fill="#fff" />
                <path d={qr.d} fill="#1F2340" />
              </svg>
              <Heart size={24} rotate={14} className="-right-3 -bottom-3" />
              <Star size={20} rotate={-12} className="-left-3 -bottom-2.5" />
            </div>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
