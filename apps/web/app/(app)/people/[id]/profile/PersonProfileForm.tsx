"use client";

import type { AvatarConfig, DateSpec, Locale, YMD } from "@readme/core";
import { useCallback, useState } from "react";
import { savePersonProfile } from "@/app/actions/people";
import { ProfileHeader } from "@/app/onboarding/Steps";
import { BirthdayLine } from "@/components/BirthdayLine";
import { AvatarBuilder, NameField } from "@/components/editors/AvatarBuilder";
import { FolderChips } from "@/components/editors/FolderChips";
import { useT } from "@/components/editors/shared";
import type { FolderView } from "@/lib/folders";
import { PersonFoldersSheet, type PersonFolderLabels } from "../PersonFolders";

/**
 * 사람 프로필 고치기: 내 프로필처럼 한 줄 머리(뒤로 · 제목 · 저장, 위에 붙어 늘 보인다) 아래에 캐릭터 만들기.
 * 큰 미리보기 옆에는 부르는 말 밑으로 폴더 칩(눌러서 폴더 시트)과 생일 줄(눌러서 날짜 고치기)이 있다
 */
export function PersonProfileForm({
  contactId,
  title,
  name,
  avatar,
  locale,
  back,
  today,
  birthday,
  folders,
  folderIds,
  folderSheet,
  labels,
}: {
  contactId: string;
  title: string;
  name: string;
  avatar: AvatarConfig;
  locale: Locale;
  back: string;
  today: YMD;
  birthday: DateSpec | null;
  folders: FolderView[];
  folderIds: string[];
  folderSheet: PersonFolderLabels;
  labels: { name: string; save: string; back: string; sheetName: string };
}) {
  const t = useT(locale);
  const [value, setValue] = useState(avatar);
  const [mine, setMine] = useState(folderIds);
  const [filing, setFiling] = useState(false);
  const closeFiling = useCallback(() => setFiling(false), []);
  return (
    <>
      <form action={savePersonProfile} className="flex flex-col">
        <input type="hidden" name="contactId" value={contactId} />
        <input type="hidden" name="avatar" value={JSON.stringify(value)} />
        <ProfileHeader title={title} back={back} backLabel={labels.back} save={labels.save} />
        <div className="px-4 pt-3">
          <AvatarBuilder
            value={value}
            onChange={setValue}
            locale={locale}
            side={
              <>
                <NameField label={labels.name} value={name} required={false} />
                <FolderChips folders={folders.filter((f) => mine.includes(f.id))} label={t("folder.label")} edit={t("folder.edit")} onOpen={() => setFiling(true)} />
                <BirthdayLine birthday={birthday} today={today} locale={locale} href={`/people/${contactId}/edit?open=dates`} t={t} />
              </>
            }
          />
        </div>
      </form>
      {/* 폴더 시트는 폼 밖에 둔다(안쪽 폼·Enter가 프로필 저장으로 새지 않게) */}
      {filing ? <PersonFoldersSheet contactId={contactId} name={labels.sheetName} folders={folders} mine={mine} labels={folderSheet} onClose={closeFiling} onSaved={setMine} /> : null}
    </>
  );
}
