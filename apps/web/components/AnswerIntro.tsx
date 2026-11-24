import type { AvatarConfig } from "@readme/core";
import { Avatar } from "@/components/Avatar";
import { Heart } from "@/components/diary";
import { Icon } from "@/components/marks";
import { Mascot } from "@/components/Mascot";
import { TornTape } from "@/components/TornTape";
import { u } from "@/lib/ui-scale";

/**
 * 답하는 화면 맨 앞의 소개 카드(물어보기 화면의 받는 사람 카드와 같은 모양): 물어본 사람 폴라로이드(꾸민 얼굴, 없으면 캐릭터) · 제목 · 그 사람만 본다는 표시 · 같이 보낸 말.
 * 여러 항목 답하기(AnswerForm)와 한 질문 답하기(AnswerQuestion)가 같이 쓴다
 */
export function AnswerIntro({ title, from, fromAvatar, message, onlyFrom }: { title: React.ReactNode; from: string; fromAvatar: AvatarConfig | null; message: string; onlyFrom: string }) {
  const box = u(72);
  return (
    <section className="card relative mx-4 mt-6 px-3.5 pb-3.5 pt-4">
      <TornTape color="pink" w={66} h={21} rotate={-38} className="-left-[15px] top-[8px]" />
      <div className="flex items-center gap-3.5">
        <figure className="relative m-0 flex shrink-0 -rotate-[4deg] flex-col items-center border border-edge bg-white px-[5.4px] pb-[12.6px] pt-[5.4px]">
          <span className="flex items-center justify-center overflow-hidden bg-white" style={{ width: box, height: box }}>
            {fromAvatar ? <Avatar config={fromAvatar} size={66} label={from} decorative /> : <Mascot pose={6} size={66} />}
          </span>
          <span aria-hidden="true" className="absolute bottom-[2.7px] flex">
            <Heart size={10} inline />
          </span>
        </figure>
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <h1 className="hand-written !font-normal text-[24px] leading-[1.2]">{title}</h1>
          <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-ink/30 bg-paper px-2.5 py-[3px] text-[11.7px]">
            <Icon name="lock" size={13} strokeWidth={1.9} className="shrink-0" />
            {onlyFrom}
          </span>
        </div>
      </div>
      {message ? <p className="hand-written mt-3 whitespace-pre-line rounded-[14px] border border-edge bg-sky-soft px-3 py-[7px] text-[16px] leading-[1.3]">{message}</p> : null}
    </section>
  );
}
