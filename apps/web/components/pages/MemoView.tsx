import { MemoPad } from "@/app/(app)/voice/MemoPad";
import type { VoiceData } from "@/lib/pages/types";
import { makeT } from "@/lib/t";

// 메모 쓰기(하단 가운데 메모 단추): 바인더 속지에 적는 메모. 체험(?tour)이 아닌 /voice가 이 화면이다
export function MemoView({ locale, today, people, fixed, shared }: VoiceData) {
  const t = makeT(locale);
  const face = (p: NonNullable<VoiceData["fixed"]>) => ({ id: p.id, name: p.name, tag: p.tag, avatar: p.avatar });
  return (
    <MemoPad
      locale={locale}
      today={today}
      people={people.map(face)}
      fixed={fixed ? face(fixed) : null}
      shared={shared}
      labels={{
        close: t("common.close"),
        importNotes: t("import.open"),
        save: t("common.save"),
        placeholderOf: t("person.quickPlaceholder", { name: "{name}" }),
        placeholder: t("memo.placeholder"),
        addPerson: t("memo.addPerson"),
        addNew: t("home.addPerson"),
        removeTag: t("memo.removeTag", { name: "{name}" }),
        pickWho: t("memo.pickWho"),
        savedTo: t("memo.savedTo", { names: "{names}" }),
        error: t("common.error"),
        micError: t("voice.micError"),
        mic: t("voice.title"),
        stopListening: t("memo.stopListening"),
        sharedClipped: t("memo.sharedClipped"),
        month: locale === "ko" ? `${today.m}월` : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][today.m - 1]!,
      }}
    />
  );
}
