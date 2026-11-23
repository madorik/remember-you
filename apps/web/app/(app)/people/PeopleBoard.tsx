"use client";

import type { AvatarConfig, Locale } from "@readme/core";
import Link from "@/components/AppLink";
import { useEffect, useMemo, useState, useTransition } from "react";
import { addToFolder, removeContacts, setFolderMembers } from "@/app/actions/people";
import { Avatar } from "@/components/Avatar";
import { FolderArt, FolderMini } from "@/components/FolderArt";
import { FolderSheet } from "@/components/FolderSheet";
import { Mascot } from "@/components/Mascot";
import { Heart, Sparkle, SKY_STAR, Squiggle, Star, Tape } from "@/components/diary";
import { DrawnCheck, Icon } from "@/components/marks";
import { RowBody, type PersonRow } from "@/components/PersonRow";
import { Sheet } from "@/components/Sheet";
import type { FolderSheetLabels, FolderView } from "@/lib/folders";
import { matchesPerson } from "@/lib/search";
import { useDragToFolder } from "./useDragToFolder";

interface Labels {
  title: string;
  /** "{n}명 · 즐겨찾기 {f}명" */
  summary: string;
  bannerTitle: string;
  bannerCta: string;
  pick: string;
  /** 직접 적기(사람 더하기) 아이콘 버튼 */
  add: string;
  cancel: string;
  withMe: string;
  meName: string;
  /** 고르는 중 머리 제목: "{n}명 선택" */
  pickedTitle: string;
  selectAll: string;
  selectNone: string;
  menu: string;
  /** 홈 기념일 카드에서 선물을 고르러 왔을 때만 메뉴 고르기 자리에 */
  gift: string;
  avatarOf: string;
  pickOne: string;
  empty: string;
  folders: string;
  /** 즐겨찾기 구역 제목(폴더 위, 접고 펴는) */
  favorites: string;
  /** 아래 목록 제목: 폴더 없음 */
  unfiled: string;
  /** 찾기 칸: "이름이나 태그로 찾기" */
  search: string;
  searchEmpty: string;
  clear: string;
  newFolder: string;
  /** "{n}명" */
  count: string;
  /** 선택 중 폴더 칩: "{name} 모두 선택" */
  pickFolder: string;
  /** 찾는 사람이 없을 때 새로 적기: "“{name}” 새로 적기" */
  addNamed: string;
  sort: string;
  sortName: string;
  sortSoon: string;
  sortRecent: string;
  /** 고른 사람 폴더에 넣기 */
  put: string;
  /** "{n}명을 {name} 폴더에 넣었어요" */
  putDone: string;
  /** 고른 사람 지우기(막대 단추) */
  remove: string;
  /** "{n}명을 지울까요?" */
  removeTitle: string;
  /** 무엇이 사라지는지 */
  removeBody: string;
  /** "{n}명을 지웠어요" */
  removed: string;
  removeConfirm: string;
  removeCancel: string;
  error: string;
}

type Sort = "name" | "soon" | "recent";

/** 오늘부터 다음 M.D("11.21")까지 며칠(없으면 Infinity). 날짜가 든 줄만 새로 계산하는 값싼 셈 */
function daysToDotted(md: string): number {
  const [m, d] = md.split(".").map(Number);
  if (!m || !d) return Infinity;
  const now = new Date();
  const t0 = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let t = Date.UTC(now.getFullYear(), m - 1, d);
  if (t < t0) t = Date.UTC(now.getFullYear() + 1, m - 1, d);
  return Math.round((t - t0) / 86400000);
}

/** 즐겨찾기는 어느 정렬이든 맨 위. 같으면 추가한 순서. sort가 없으면 지금 순서(즐겨찾기 → 추가한 순서) 그대로 */
function sortRows(rows: PersonRow[], sort: Sort | null, locale: Locale): PersonRow[] {
  if (!sort) return rows;
  const order = new Map(rows.map((r, i) => [r.contactId, i]));
  const at = (r: PersonRow) => order.get(r.contactId)!;
  const fav = (a: PersonRow, b: PersonRow) => Number(b.favorite) - Number(a.favorite);
  if (sort === "name") {
    const collator = new Intl.Collator(locale === "ko" ? "ko" : "en");
    return [...rows].sort((a, b) => fav(a, b) || collator.compare(a.name, b.name) || at(a) - at(b));
  }
  if (sort === "soon") {
    const days = new Map(rows.map((r) => [r.contactId, r.date ? daysToDotted(r.date) : Infinity]));
    const cmp = (x: number, y: number) => (x === y ? 0 : x < y ? -1 : 1);
    return [...rows].sort((a, b) => fav(a, b) || cmp(days.get(a.contactId)!, days.get(b.contactId)!) || at(a) - at(b));
  }
  return [...rows].sort((a, b) => fav(a, b) || at(b) - at(a));
}

/** 찾는 사람이 없을 때: 찾던 이름으로 새 사람 적기 */
function NewNamed({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn-outline !h-12 min-w-0 px-4">
      <Icon name="personAdd" size={18} strokeWidth={2} />
      <span className="min-w-0 truncate">{label}</span>
    </Link>
  );
}

/** 목록이 길어도 화면 밖 줄은 그리지 않게(사람이 많고 얼굴 그림이 많을 때만) */
const LONG_LIST = 40;
/** 폴더 칸을 살짝씩 다르게 기울인 종이 */
const FOLDER_TILT = ["-rotate-[0.8deg]", "rotate-[0.6deg]", "-rotate-[0.5deg]", "rotate-[0.7deg]"];
const LAZY_ROW = "[content-visibility:auto] [contain-intrinsic-size:auto_71px]";

/**
 * 내 사람들: 맨 위에 즐겨찾기한 사람(어느 폴더에 있든 모아서, 제목을 눌러 접고 편다), 그 아래 폴더 칸(누르면 그 폴더, 맨 끝은 새 폴더), 아래에 아직 폴더에 없는 사람(즐겨찾기 먼저).
 * 아래 사람을 길게 눌러(마우스는 끌어) 위 폴더 칸에 놓으면 그 폴더에 들어간다.
 * "선택"을 누르면 사람을 고르는 모드가 되고(머리가 ✕ · N명 선택 · 전체 선택으로 바뀌고, 칩 한 줄로 나도 같이·폴더 사람을 한 번에, 줄 어디를 눌러도 체크),
 * 한 명이라도 고르면 탭 막대 자리에 동작 막대(지우기 · 폴더에 넣기 · 메뉴 고르기)가 들어선다.
 * 고른 상태는 주소(pick=1&with=…&me=…)로 오가서, 메뉴 화면에서 뒤로 와도 그대로다.
 */
export function PeopleBoard({
  locale,
  rows,
  folders,
  meAvatar,
  initialPick,
  initial,
  initialMe,
  initialGift,
  initialXmas,
  labels,
  sheet,
}: {
  locale: Locale;
  rows: PersonRow[];
  folders: FolderView[];
  meAvatar: AvatarConfig | null;
  initialPick: boolean;
  initial: string[];
  initialMe: boolean;
  initialGift: boolean;
  initialXmas: boolean;
  labels: Labels;
  sheet: FolderSheetLabels;
}) {
  const canPick = rows.length > 0;
  // 처음 상태: 주소에서 읽는다. 기기 뒤로가기로 돌아오면 Next가 예전 화면을 다시 쓰는데, 그때도 주소(고르던 체크)는 맞으므로
  const [start] = useState(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/people") {
      const q = new URLSearchParams(window.location.search);
      return { pick: q.get("pick") === "1", ids: (q.get("with") ?? "").split(",").filter(Boolean), me: q.get("me") !== "0", gift: q.get("to") === "gift", xmas: q.get("xmas") === "1" };
    }
    return { pick: initialPick, ids: initial, me: initialMe, gift: initialGift, xmas: initialXmas };
  });
  const [pickOn, setPicking] = useState(start.pick && canPick);
  // 다 지워서 고를 사람이 없어지면 고르기도 같이 끝난다
  const picking = pickOn && canPick;
  const [picked, setPicked] = useState<string[]>(start.ids.filter((id) => rows.some((r) => r.contactId === id)));
  const [withMe, setWithMe] = useState(start.me);
  // 홈 기념일 카드의 '선물 고르기'로 들어온 경우(?to=gift): 동작 막대의 큰 단추가 메뉴 대신 선물 고르기
  const forGift = start.gift;
  // 고른 사람을 폴더에 넣은 결과(알림 줄에 잠깐)
  const [putMsg, setPutMsg] = useState<{ text: string; error: boolean } | null>(null);
  const [putOpen, setPutOpen] = useState(false);
  // 고른 사람 지우기: 확인 시트를 거치고, 지우는 동안 지우기 단추는 눌림 막힘
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, startRemove] = useTransition();
  const toggle = (id: string) => {
    setPutMsg(null);
    setPicked(picked.includes(id) ? picked.filter((x) => x !== id) : rows.map((r) => r.contactId).filter((x) => x === id || picked.includes(x)));
  };
  // 폴더 칩: 그 폴더 사람을 한 번에 넣고 뺀다
  const toggleMany = (ids: string[], on: boolean) => {
    setPutMsg(null);
    setPicked(on ? rows.map((r) => r.contactId).filter((x) => ids.includes(x) || picked.includes(x)) : picked.filter((x) => !ids.includes(x)));
  };
  // 목록 정렬: 처음엔 지금 순서(즐겨찾기 → 추가한 순서). 칩을 한 번 더 누르면 처음으로
  const [sort, setSort] = useState<Sort | null>(null);
  const ordered = useMemo(() => sortRows(rows, sort, locale), [rows, sort, locale]);
  const q = new URLSearchParams();
  if (picked.length) q.set("with", picked.join(","));
  q.set("me", withMe ? "1" : "0");
  const query = `?${q.toString()}`;
  // 지금 상태를 주소에 적어 둔다: 상세로 갔다가 뒤로(버튼·기기 뒤로가기) 와도 고르던 체크가 그대로다
  const here = picking ? `/people${query}&pick=1${forGift ? "&to=gift" : ""}${forGift && start.xmas ? "&xmas=1" : ""}` : "/people";
  useEffect(() => {
    if (window.location.pathname + window.location.search !== here) window.history.replaceState(window.history.state, "", here);
  }, [here]);
  const [making, setMaking] = useState(false);
  // 즐겨찾기 구역은 처음엔 펴져 있고, 제목을 누르면 접힌다
  const [favOpen, setFavOpen] = useState(true);
  // 찾기: 적는 동안은 폴더 칸 대신 찾은 사람(폴더와 상관없이 모두에서). 선택 중이면 고르는 목록을 줄인다
  const [find, setFind] = useState("");
  const searching = !!find.trim();
  const found = searching ? ordered.filter((r) => matchesPerson(find, r.name, r.tag)) : ordered;
  // 찾은 사람이 없으면 그 이름으로 새로 적으러 간다
  const newName = find.replace(/\s+/g, " ").trim().slice(0, 40);
  // 전체 선택: 지금 보이는 사람 모두(찾는 중이면 찾은 사람). 모두 골랐으면 같은 단추가 선택 해제
  const visibleIds = found.map((r) => r.contactId);
  const allOn = visibleIds.length > 0 && visibleIds.every((id) => picked.includes(id));
  const toggleAll = () => toggleMany(visibleIds, !allOn);
  // 머리 제목 "3명 선택": 첫 낱말(3명)에만 형광펜
  const [pickedHead = "", ...pickedTail] = labels.pickedTitle.replace("{n}", String(picked.length)).split(" ");
  const pickedRest = pickedTail.join(" ");

  // 끌어 놓기: 놓는 즉시 화면에서 넣고(서버가 다시 그리면 그 값으로), 실패하면 되돌린다
  // 화면에서 먼저 넣은 것은 서버가 새 목록(rows)을 주면 버린다
  const [local, setLocal] = useState<{ rows: PersonRow[]; added: Record<string, string[]> }>({ rows, added: {} });
  const added = local.rows === rows ? local.added : {};
  const [, startDrop] = useTransition();
  const drag = useDragToFolder({
    enabled: !picking && !searching,
    onDrop: (contactId, folderId) => {
      setLocal((l) => {
        const cur = l.rows === rows ? l.added : {};
        return { rows, added: { ...cur, [contactId]: [...(cur[contactId] ?? []), folderId] } };
      });
      startDrop(async () => {
        const r = await addToFolder(folderId, contactId);
        if (!r.ok)
          setLocal((l) => ({ rows, added: Object.fromEntries(Object.entries(l.rows === rows ? l.added : {}).filter(([id]) => id !== contactId)) }));
      });
    },
  });
  const membersOf = (f: FolderView) => [...f.memberIds, ...Object.keys(added).filter((id) => added[id]!.includes(f.id) && !f.memberIds.includes(id))];
  const unfiled = ordered.filter((r) => !r.folderIds.length && !added[r.contactId]?.length);
  const favRows = ordered.filter((r) => r.favorite);
  const lazyRow = rows.length > LONG_LIST ? LAZY_ROW : "";

  const byId = new Map(rows.map((r) => [r.contactId, r]));
  const facesOf = (f: FolderView) =>
    membersOf(f)
      .map((id) => byId.get(id))
      .filter((r): r is PersonRow => !!r)
      .map((r) => ({ key: r.contactId, avatar: r.avatar, label: r.name }));
  const ready = picked.length > 0;
  // 사람을 고르면 하단 메뉴 자리에 동작 막대가 들어선다: 화면 틀의 하단 메뉴는 <html data-bar-swap>으로 숨긴다(globals.css)
  const swapBar = picking && ready;
  useEffect(() => {
    const root = document.documentElement;
    root.toggleAttribute("data-bar-swap", swapBar);
    return () => root.removeAttribute("data-bar-swap");
  }, [swapBar]);
  // 고른 사람을 폴더 하나에 한꺼번에: 넣는 즉시 화면에서 넣고(서버가 다시 그리면 그 값으로), 실패하면 되돌린다
  const putIn = (f: FolderView) => {
    const current = membersOf(f);
    const ids = picked.filter((id) => byId.has(id) && !current.includes(id));
    setPutOpen(false);
    setPicked([]);
    setPutMsg({ text: labels.putDone.replace("{n}", String(picked.length)).replace("{name}", f.name), error: false });
    if (!ids.length) return;
    setLocal((l) => {
      const cur = l.rows === rows ? l.added : {};
      const next = { ...cur };
      for (const id of ids) next[id] = [...(next[id] ?? []), f.id];
      return { rows, added: next };
    });
    startDrop(async () => {
      const r = await setFolderMembers(f.id, [...current, ...ids]).catch(() => ({ ok: false }));
      if (r.ok) return;
      setPutMsg({ text: labels.error, error: true });
      setLocal((l) => {
        const cur = l.rows === rows ? l.added : {};
        const next = { ...cur };
        for (const id of ids) {
          const left = (next[id] ?? []).filter((x) => x !== f.id);
          if (left.length) next[id] = left;
          else delete next[id];
        }
        return { rows, added: next };
      });
    });
  };
  // 고른 사람을 한꺼번에 지운다. 서버가 새 목록을 주면 화면에서도 빠지고, 실패하면 고른 채로 두고 알린다
  const removePicked = () => {
    const ids = picked.filter((id) => byId.has(id));
    if (!ids.length) return;
    startRemove(async () => {
      const r = await removeContacts(ids).catch(() => ({ ok: false, removed: 0 }));
      setRemoveOpen(false);
      if (r.ok) {
        setPicked([]);
        setPutMsg({ text: labels.removed.replace("{n}", String(r.removed)), error: false });
      } else {
        setPutMsg({ text: labels.error, error: true });
      }
    });
  };
  // 같이 뭐할지(메뉴 고르기). 홈 기념일 카드에서 선물을 고르러 온 경우에만 선물 고르기가 그 자리에 온다
  // 선물 고르기에 한 명만(나는 빼고) 골랐으면 그 사람의 선물 고르기 화면으로(사람 화면의 '선물 고르기'와 같은 곳, 홈 연말 카드에서 왔으면 크리스마스용), 여럿이면 같이 고르기
  const onlyOne = forGift && !withMe && picked.length === 1 ? picked[0]! : null;
  const planHref = onlyOne ? `/people/${onlyOne}/reminder${start.xmas ? "?xmas=1" : ""}` : `${forGift ? "/plan/gift" : "/plan/menu"}${query}`;
  const planLabel = forGift ? labels.gift : labels.menu;
  const favCount = rows.filter((r) => r.favorite).length;
  // 정렬 칩(이름순 · 생일 가까운 순 · 최근 추가순). 즐겨찾기는 늘 맨 위
  const sortChips = (
    <div role="group" aria-label={labels.sort} className="flex flex-wrap gap-2 pb-3">
      {(
        [
          ["name", labels.sortName],
          ["soon", labels.sortSoon],
          ["recent", labels.sortRecent],
        ] as const
      ).map(([key, label]) => (
        <button key={key} type="button" aria-pressed={sort === key} onClick={() => setSort(sort === key ? null : key)} className="chip !min-h-11 !px-3.5 !text-[16px]">
          {label}
        </button>
      ))}
    </div>
  );
  const filled = folders.filter((f) => f.memberIds.some((id) => byId.has(id)));

  return (
    <>
      {picking ? (
        <div className="relative flex items-center gap-2.5 pl-3.5 pr-4 pt-4">
          <Star size={18} rotate={14} className="left-[150px] top-[10px]" />
          <button
            type="button"
            aria-label={labels.cancel}
            onClick={() => setPicking(false)}
            className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--color-edge)] transition-transform active:scale-95"
          >
            <Icon name="close" size={22} strokeWidth={2} />
          </button>
          <h1 aria-live="polite" className="min-w-0 flex-1 truncate text-[30px] leading-[1.1]">
            <span className="hl">{pickedHead}</span>
            {pickedRest ? ` ${pickedRest}` : ""}
          </h1>
          <button type="button" onClick={toggleAll} className="pill relative shrink-0 !text-[17px]">
            {allOn ? labels.selectNone : labels.selectAll}
          </button>
        </div>
      ) : (
        <div className="relative flex items-end justify-between gap-2 pl-5 pr-4 pt-4">
          <Star size={20} rotate={14} className="left-[150px] top-[18px]" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-[32px] leading-[1.1]">{labels.title}</h1>
            {rows.length ? <span className="text-[16px] text-muted">{labels.summary.replace("{n}", String(rows.length)).replace("{f}", String(favCount))}</span> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* 직접 적기: 사람 아이콘 + */}
            <Link
              href="/people/new"
              aria-label={labels.add}
              className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[inset_0_0_0_1.5px_var(--color-edge)] transition-transform active:scale-95"
            >
              <Icon name="personAdd" size={22} strokeWidth={1.9} />
            </Link>
            {canPick ? (
              <button type="button" onClick={() => setPicking(true)} className="pill relative shrink-0 !gap-1.5 !pl-[13px] !pr-4 !text-[18px]">
                <Icon name="check" size={19} strokeWidth={2} />
                {labels.pick}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {rows.length ? (
        <div className="relative px-4 pt-4">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" className="pointer-events-none absolute left-[31px] top-[30px] text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            type="search"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder={labels.search}
            aria-label={labels.search}
            enterKeyHint="search"
            className="h-12 w-full rounded-2xl bg-white pl-[44px] pr-12 text-[18px] shadow-[inset_0_0_0_1.5px_var(--color-edge)] outline-none placeholder:text-muted focus:shadow-[inset_0_0_0_2px_var(--color-mango-deep)] [&::-webkit-search-cancel-button]:appearance-none"
          />
          {find ? (
            <button type="button" aria-label={labels.clear} onClick={() => setFind("")} className="absolute right-5 top-[18px] flex h-11 w-11 items-center justify-center text-muted">
              <Icon name="close" size={18} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      ) : null}

      {/* 물어보기: 찾기 칸 밑 한 줄(카드 전체를 누른다). 찾는 중·선택 중에는 숨긴다 */}
      {picking || searching || !rows.length ? null : (
        <Link
          href="/request"
          className="card relative mx-4 mt-3.5 flex min-h-[68px] items-center gap-3 py-2 pl-2 pr-2.5 transition-transform active:scale-[0.99]"
        >
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-lg bg-[#d3e9ff]">
            <Mascot pose={6} size={44} />
          </span>
          <span className="min-w-0 flex-1 text-[19px] leading-[1.3]">{labels.bannerTitle}</span>
          <span className="flex h-[38px] shrink-0 items-center gap-0.5 rounded-full bg-sky pl-3.5 pr-2 text-[17px] shadow-[inset_0_0_0_1.5px_var(--color-ink)]">
            {labels.bannerCta}
            <Icon name="chevron" size={17} strokeWidth={2.2} />
          </span>
          <Tape color="mint" w={66} h={20} rotate={5} alpha={0.55} vertical className="-top-[9px] right-[26px]" />
        </Link>
      )}

      {picking ? (
        <div className="flex flex-col px-4">
          {/* 빠른 고르기 칩 한 줄: 나도 같이(켜고 끈다) + 폴더 모두 선택. 정렬 칩은 고르는 동안 뺀다 */}
          <div role="group" aria-label={labels.folders} className="-mx-4 -mb-[3px] flex gap-2 overflow-x-auto px-4 pb-[3px] pt-3 [scrollbar-width:none]">
            <button
              type="button"
              aria-pressed={withMe}
              onClick={() => setWithMe(!withMe)}
              className={`relative flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pl-2 pr-3.5 text-[17px] before:absolute before:-inset-y-[3px] before:inset-x-0 before:content-[''] ${withMe ? "chip-on" : "bg-white shadow-[inset_0_0_0_1.5px_var(--color-edge)]"}`}
            >
              <Avatar config={meAvatar} size={24} label={labels.meName} decorative />
              {labels.withMe}
            </button>
            {filled.map((f) => {
              const ids = f.memberIds.filter((id) => byId.has(id));
              const all = ids.every((id) => picked.includes(id));
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={all}
                  aria-label={labels.pickFolder.replace("{name}", f.name)}
                  onClick={() => toggleMany(ids, !all)}
                  className={`relative flex h-[38px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pl-3 pr-3.5 text-[17px] before:absolute before:-inset-y-[3px] before:inset-x-0 before:content-[''] ${all ? "chip-on" : "bg-white shadow-[inset_0_0_0_1.5px_var(--color-edge)]"}`}
                >
                  <FolderMini color={f.color} size={18} />
                  {f.name}
                  <span className="num text-[15px] text-muted">{ids.length}</span>
                </button>
              );
            })}
          </div>
          {searching && !found.length ? (
            <div className="flex flex-col gap-3 px-2 pt-5">
              <p className="text-[16px] text-muted">{labels.searchEmpty}</p>
              {newName ? <NewNamed href={`/people/new?name=${encodeURIComponent(newName)}`} label={labels.addNamed.replace("{name}", newName)} /> : null}
            </div>
          ) : null}
          {/* 체크는 왼쪽, 줄 어디를 눌러도 고른다. 고른 줄은 연한 망고 */}
          <div className={`card relative mt-5 ${found.length ? "" : "hidden"}`}>
            <Tape color="pink" w={54} h={18} rotate={-34} className="-left-2 -top-[9px]" />
            <ul className="flex flex-col">
              {found.map((r) => {
                const on = picked.includes(r.contactId);
                return (
                  <li key={r.contactId} className={`border-t border-dashed border-rule first:rounded-t-[10px] first:border-t-0 last:rounded-b-[10px] ${on ? "bg-sky-soft" : ""} ${lazyRow}`}>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={labels.pickOne.replace("{name}", r.tag ? `${r.name} ${r.tag}` : r.name)}
                      onClick={() => toggle(r.contactId)}
                      className="flex min-h-[72px] w-full items-center gap-3 px-3.5 text-left"
                    >
                      <DrawnCheck on={on} />
                      <RowBody row={r} avatarLabel={labels.avatarOf.replace("{name}", r.name)} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : searching ? (
        found.length ? (
          <ul className="card mx-4 mt-3.5 flex flex-col px-3.5">
            {found.map((r) => (
              <li key={r.contactId} className={`border-t border-dashed border-rule first:border-t-0 ${lazyRow}`}>
                <Link href={`/people/${r.contactId}`} className="flex min-h-[72px] items-center gap-3">
                  <RowBody row={r} avatarLabel={labels.avatarOf.replace("{name}", r.name)} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-3 px-6 pt-6">
            <p className="text-[16px] text-muted">{labels.searchEmpty}</p>
            {newName ? <NewNamed href={`/people/new?name=${encodeURIComponent(newName)}`} label={labels.addNamed.replace("{name}", newName)} /> : null}
          </div>
        )
      ) : (
        <div onClickCapture={drag.onClickCapture}>
          {/* 아직 아무도 없으면 홈 빈 화면과 같은 두 가지로 시작한다 */}
          {rows.length ? null : (
            <section className="card mx-4 mt-4 flex flex-col gap-3 px-4 pb-4 pt-5">
              <p className="px-1.5 text-[17px] leading-[1.5] text-muted">{labels.empty}</p>
              <div className="grid grid-cols-2 gap-2.5">
                <Link href="/people/new" className="btn-outline">
                  {labels.add}
                </Link>
                <Link href="/request" className="btn-primary">
                  {labels.bannerCta}
                </Link>
              </div>
            </section>
          )}
          {/* 즐겨찾기: 어느 폴더에 있든 한곳에 모아 바로 본다. 제목을 누르면 접힌다 */}
          {favRows.length ? (
            <section aria-label={labels.favorites} className="relative">
              <h2 className="px-6 pt-3">
                <button type="button" aria-expanded={favOpen} aria-controls="people-fav" onClick={() => setFavOpen(!favOpen)} className="flex min-h-11 w-full items-center gap-2 text-left">
                  <span className="text-[22px] font-normal">{labels.favorites}</span>
                  <span className="text-[17px] text-muted">{favRows.length}</span>
                  <Icon name="chevron" size={18} strokeWidth={2.2} className={`ml-auto text-muted transition-transform ${favOpen ? "-rotate-90" : "rotate-90"}`} />
                </button>
              </h2>
              {favOpen ? (
                <div id="people-fav" className="card relative mx-4 mt-1.5 px-3.5">
                  <ul className="flex flex-col">
                    {favRows.map((r) => (
                      <li key={r.contactId} className={`border-t border-dashed border-rule first:border-t-0 ${lazyRow}`}>
                        <Link href={`/people/${r.contactId}`} className="flex min-h-[72px] items-center gap-3">
                          <RowBody row={r} avatarLabel={labels.avatarOf.replace("{name}", r.name)} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          ) : null}
          <section aria-label={labels.folders} className="relative">
          <h2 className="flex items-baseline gap-2 px-6 pb-3 pt-6">
            <span className="text-[22px] font-normal">{labels.folders}</span>
            <span className="text-[17px] text-muted">{folders.length}</span>
          </h2>
          <div className="flex items-start gap-2 px-4">
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-x-2.5 gap-y-3">
            {folders.map((f, i) => {
              // 끄는 중 손가락 아래 폴더는 망고 테두리로
              const target = !!drag.dragging && drag.over === f.id;
              return (
                <Link
                  key={f.id}
                  href={`/people/folder/${f.id}`}
                  data-drop={f.id}
                  className={`card flex min-w-0 flex-col items-center gap-0.5 px-1 pb-3 pt-4 transition-[transform,background-color,box-shadow] active:scale-[0.97] ${FOLDER_TILT[i % FOLDER_TILT.length]} ${
                    target ? "scale-[1.04] !bg-sky-soft !shadow-[inset_0_0_0_2px_var(--color-sky)]" : ""
                  }`}
                >
                  <FolderArt icon={f.icon} color={f.color} size={86} faces={facesOf(f)} />
                  <span className="mt-1.5 w-full truncate text-center text-[19px]">{f.name}</span>
                  <span className="text-[15px] text-muted">{labels.count.replace("{n}", String(membersOf(f).length))}</span>
                </Link>
              );
            })}
          </div>
          {/* 새 폴더: 글자 없이 아이콘만, 폴더들 바로 옆(첫 줄 폴더의 가운데 높이) */}
          <button
            type="button"
            aria-label={labels.newFolder}
            aria-haspopup="dialog"
            onClick={() => setMaking(true)}
            className="mt-[46px] flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[1.8px] border-dashed border-ink text-ink transition-transform active:scale-95"
          >
            <Icon name="plus" size={22} strokeWidth={2.2} />
          </button>
          </div>
          <Heart size={24} rotate={-12} className="left-28 top-[62px]" />
          <Star size={22} rotate={12} color={SKY_STAR} className="right-2 top-7" />
          <Squiggle w={54} width={2.4} className="-bottom-1.5 left-[30px]" />
          </section>

          {/* 아직 폴더에 없는 사람만. 다 넣었으면 이 칸은 없다 */}
          {unfiled.length ? (
            <>
              <section aria-label={labels.unfiled} className="relative">
              <h2 className="flex items-baseline gap-2 px-6 pb-3 pt-7">
                <span className="text-[22px] font-normal">{labels.unfiled}</span>
                <span className="text-[17px] text-muted">{unfiled.length}</span>
              </h2>
              {unfiled.length > 1 ? <div className="px-4">{sortChips}</div> : null}
              <div className="card relative mx-4 px-3.5">
                <Tape color="pink" w={54} h={18} rotate={-34} className="-left-2 -top-[9px]" />
                <ul className="flex flex-col">
                {unfiled.map((r) => (
                  <li
                    key={r.contactId}
                   
                    onPointerDown={(e) => drag.onPointerDown(e, r.contactId, r.name, "list")}
                    onContextMenu={(e) => e.preventDefault()}
                    className={`select-none border-t border-dashed border-rule first:border-t-0 [-webkit-touch-callout:none] ${lazyRow} ${drag.dragging?.id === r.contactId ? "opacity-40" : ""}`}
                  >
                    <Link href={`/people/${r.contactId}`} draggable={false} className="flex min-h-[72px] items-center gap-3">
                      <RowBody row={r} avatarLabel={labels.avatarOf.replace("{name}", r.name)} />
                    </Link>
                  </li>
                ))}
                </ul>
                <Sparkle size={18} className="right-[22px] top-[22px]" />
              </div>
              </section>
            </>
          ) : null}
        </div>
      )}

      {/* 고른 사람을 폴더에 넣은 결과·오류(막대 위에 잠깐, 다음에 사람을 누르면 사라진다) */}
      {picking && putMsg ? (
        <div className="sticky z-20 flex justify-center px-5 py-2" style={{ bottom: "calc(var(--tab-h) + var(--pb-tab))" }}>
          <span role="status" className={`card px-4 py-2 text-[16px] ${putMsg.error ? "text-red" : ""}`}>
            {putMsg.text}
          </span>
        </div>
      ) : null}
      <div className="h-5" />
      {/* 한 명이라도 고르면 하단 메뉴(화면 틀에 있다)를 숨기고 그 자리에 동작 막대가 들어선다: 지우기(작은 빨간 단추) · 폴더에 넣기 · 메뉴 고르기(주). 아무도 안 골랐으면 하단 메뉴 그대로 */}
      {picking && ready ? (
        <div
          role="toolbar"
          aria-label={labels.pick}
          data-tabbar=""
          className="sticky bottom-0 z-30 mt-auto bg-paper px-4 pt-2 shadow-[inset_0_1.5px_0_rgb(31_35_64/0.12)]"
          style={{ paddingBottom: "var(--pb-tab)" }}
        >
          <div className="flex h-[70px] items-center gap-2.5">
            <button
              type="button"
              aria-label={labels.remove}
              aria-haspopup="dialog"
              onClick={() => setRemoveOpen(true)}
              className="flex h-[52px] w-14 shrink-0 items-center justify-center rounded-2xl bg-red-soft text-red shadow-[inset_0_0_0_1.5px_var(--color-red),0_4px_0_rgb(200_40_58/0.3)] transition-transform active:translate-y-0.5"
            >
              <Icon name="trash" size={24} strokeWidth={1.9} />
            </button>
            <button type="button" onClick={() => setPutOpen(true)} className="btn-outline btn-outline-lift min-w-0 flex-1 whitespace-nowrap !gap-1.5">
              <FolderMini color="mango" size={22} />
              {labels.put}
            </button>
            <Link href={planHref} className="btn-primary min-w-0 flex-1 whitespace-nowrap">
              {planLabel}
            </Link>
          </div>
        </div>
      ) : null}
      {making ? <FolderSheet labels={sheet} onClose={() => setMaking(false)} /> : null}
      {removeOpen ? (
        <Sheet
          id="people-remove-title"
          title={labels.removeTitle.replace("{n}", String(picked.length))}
          closeLabel={labels.clear}
          onClose={() => setRemoveOpen(false)}
          footer={
            <div className="grid grid-cols-2 gap-2">
              {/* 처음 포커스는 취소: 실수로 엔터를 쳐도 안 지워진다 */}
              <button type="button" autoFocus onClick={() => setRemoveOpen(false)} className="btn-soft">
                {labels.removeCancel}
              </button>
              <button type="button" disabled={removing} aria-busy={removing} onClick={removePicked} className="btn-soft !bg-red !text-white !shadow-none disabled:opacity-50 motion-safe:disabled:animate-pulse">
                {labels.removeConfirm}
              </button>
            </div>
          }
        >
          <p className="px-6 pb-3 pt-1 text-[17px] leading-[1.5]">{labels.removeBody.replace("{n}", String(picked.length))}</p>
        </Sheet>
      ) : null}
      {putOpen ? (
        <Sheet id="people-put-title" title={labels.put} closeLabel={labels.clear} onClose={() => setPutOpen(false)}>
          <ul className="flex flex-col px-6" style={{ paddingBottom: "max(var(--pb), 16px)" }}>
            {folders.map((f) => (
              <li key={f.id} className="border-t border-dashed border-rule first:border-t-0">
                <button type="button" onClick={() => putIn(f)} className="flex min-h-14 w-full items-center gap-3 text-left">
                  <FolderMini color={f.color} size={22} />
                  <span className="min-w-0 flex-1 truncate text-[19px]">{f.name}</span>
                  <span className="num text-[15px] text-muted">{membersOf(f).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      ) : null}
      {drag.ghost}
    </>
  );
}
