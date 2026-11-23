import type { AvatarConfig } from "@readme/core";
import { Avatar } from "./Avatar";

// 사람 목록 한 줄(서버 목록과 고르기 화면이 같이 쓴다). 서버 전용 모듈을 들이지 않는다

/** 사람 목록 한 줄에 보일 것(서버에서 만들어 화면 컴포넌트에 넘긴다) */
export interface PersonRow {
  contactId: string;
  /** 그 사람 이름(앱 사용자와 이어지지 않은 사람은 내가 적은 말) */
  name: string;
  /** 내가 붙인 태그(부르는 말). 이름과 같거나 없으면 "" */
  tag: string;
  sub: string;
  avatar: AvatarConfig | null;
  /** 다음 생일 "11.21" */
  date: string;
  /** "7일 남음" 또는 "음력 10월 13일" */
  dateSub: string;
  /** 7일 안이면 붉게 */
  soon: boolean;
  /** 들어 있는 폴더(여러 개) */
  folderIds: string[];
  /** 즐겨찾기(맨 위에 고정) */
  favorite: boolean;
}

/** 이름 옆 태그(내가 붙인 부르는 말) */
export function TagChip({ children, large = false }: { children: React.ReactNode; large?: boolean }) {
  return (
    <span className={`max-w-[9em] shrink-0 truncate rounded-md bg-fill text-muted ${large ? "px-2 py-[2.7px] text-[12.6px]" : "px-1.5 py-px text-[10.8px]"}`}>
      {children}
    </span>
  );
}

/**
 * 한 줄의 가운데·오른쪽(링크와 고르기 칸이 같이 쓴다): 얼굴 40 · 이름(손글씨) + 태그·들어 있는 폴더 · 오른쪽에 날짜와 며칠 남았는지.
 * 얼굴은 이름이 같은 줄에 있어 스크린리더에서 숨긴다(avatarLabel은 부르는 쪽 호환용으로 받기만 한다)
 */
export function RowBody({ row }: { row: PersonRow; avatarLabel?: string }) {
  return (
    <>
      <Avatar config={row.avatar} size={40} label={row.name} decorative />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="hand-written truncate pr-1 text-[20.3px] leading-[1.1]">{row.name}</span>
          {row.favorite ? (
            <svg aria-hidden="true" width="13.5" height="13.5" viewBox="0 0 24 24" fill="#E8627C" className="shrink-0">
              <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />
            </svg>
          ) : null}
          {row.tag ? <TagChip>{row.tag}</TagChip> : null}
        </span>
        {row.sub ? <span className="truncate text-[10.8px] text-muted">{row.sub}</span> : null}
      </span>
      {row.date ? (
        <span className="flex flex-col items-end gap-0.5">
          <span className="num text-[17px]">{row.date}</span>
          <span className={`text-[9.9px] ${row.soon ? "text-red" : "text-muted"}`}>{row.dateSub}</span>
        </span>
      ) : null}
    </>
  );
}
