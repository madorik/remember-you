"use client";

import type { Locale } from "@readme/core";
import { useState } from "react";
import { deleteAccount } from "@/app/actions/account";
import { useT } from "@/components/editors/shared";

/** 계정 삭제: 한 번 더 묻고 지운다(프로필 화면 맨 아래) */
export function DeleteAccount({ locale }: { locale: Locale }) {
  const t = useT(locale);
  const [ask, setAsk] = useState(false);
  if (!ask) {
    return (
      <button type="button" onClick={() => setAsk(true)} className="flex min-h-[45px] items-center text-[15px] text-red">
        {t("privacy.delete")}
      </button>
    );
  }
  return (
    <form action={deleteAccount} role="alertdialog" aria-label={t("privacy.delete")} className="my-3.5 flex w-full flex-col gap-3.5 rounded-[14px] bg-white p-4 shadow-[inset_0_0_0_1.5px_var(--color-red)]">
      <input type="hidden" name="confirm" value="1" />
      <p className="text-[15px] leading-[1.5]">{t("privacy.deleteConfirm")}</p>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setAsk(false)} className="btn-outline btn-outline-lift !rounded-[14px] !text-[22px]">
          {t("common.cancel")}
        </button>
        <button className="btn-primary !rounded-[14px] !bg-red !text-[22px] !text-white">{t("privacy.deleteYes")}</button>
      </div>
    </form>
  );
}
