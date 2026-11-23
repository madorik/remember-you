"use client";

import type { Locale } from "@readme/core";
import { useState, useTransition } from "react";
import { resendRequest, type InviteState } from "@/app/actions/request";
import { useT } from "@/components/editors/shared";
import { Sheet } from "@/components/Sheet";
import { LinkField, ShareButtons, nativeShare } from "@/components/ShareButtons";

/**
 * 답을 기다리는 사람에게 '다시 보내기': 같은 사람·같은 항목으로 새 링크를 만들고 곧바로 공유창을 연다.
 * 공유창이 없는 브라우저(PC 등)나 공유를 못 열었으면 링크를 보여 주는 시트에서 복사·공유한다
 */
export function ResendLink({ locale, contactId, className }: { locale: Locale; contactId: string; className?: string }) {
  const t = useT(locale);
  const [pending, start] = useTransition();
  const [made, setMade] = useState<InviteState | null>(null);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        className={className}
        onClick={() =>
          start(async () => {
            setFailed(false);
            const r = await resendRequest(contactId);
            if (!r.url) return setFailed(true);
            // 휴대폰이면 바로 공유창, 아니면(또는 못 열었으면) 링크 시트
            if (!(await nativeShare(r.text, r.url))) setMade(r);
          })
        }
      >
        {failed ? t("common.error") : t("person.resend")}
      </button>
      {made?.url ? (
        <Sheet
          id="resend-sheet"
          title={t("request.send")}
          closeLabel={t("common.close")}
          onClose={() => setMade(null)}
          footer={<ShareButtons locale={locale} url={made.url} text={made.text} sendLabel={t("request.send")} />}
        >
          <div className="px-6 pb-2 pt-1">
            <LinkField url={made.url} label={t("common.copyLink")} />
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
