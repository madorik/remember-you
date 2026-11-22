// 폴더 모양·색(서버·화면이 같이 쓴다. 서버 전용 모듈을 들이지 않는다)
import type { T } from "./i18n";

export const FOLDER_ICONS = ["heart", "star", "home", "work", "plane", "gift", "cake", "cup"] as const;
export type FolderIcon = (typeof FOLDER_ICONS)[number];

export const FOLDER_COLORS = ["mango", "pink", "peach", "mint", "lavender", "sky"] as const;
export type FolderColor = (typeof FOLDER_COLORS)[number];

export function isFolderIcon(v: unknown): v is FolderIcon {
  return typeof v === "string" && (FOLDER_ICONS as readonly string[]).includes(v);
}

export function isFolderColor(v: unknown): v is FolderColor {
  return typeof v === "string" && (FOLDER_COLORS as readonly string[]).includes(v);
}

/** 폴더 앞주머니 가운데 그림(뷰박스 72×56의 가운데 36,36 둘레). 흰 채움 + 남색 선 */
export const ICON_PATH: Record<FolderIcon, string> = {
  heart: "M36 42.5c-4.2-2.9-7-5.4-7-8.6 0-2 1.6-3.6 3.6-3.6 1.5 0 2.7.9 3.4 2.1.7-1.2 1.9-2.1 3.4-2.1 2 0 3.6 1.6 3.6 3.6 0 3.2-2.8 5.7-7 8.6z",
  star: "M36 29 L37.88 33.41 L42.66 33.84 L39.04 36.99 L40.11 41.66 L36 39.2 L31.89 41.66 L32.96 36.99 L29.34 33.84 L34.12 33.41 Z",
  home: "M30 36.5 36 31l6 5.5V42a1 1 0 0 1-1 1h-3v-4h-4v4h-3a1 1 0 0 1-1-1z",
  work: "M31.1 32.5h9.8a1.6 1.6 0 0 1 1.6 1.6v6.3a1.6 1.6 0 0 1-1.6 1.6h-9.8a1.6 1.6 0 0 1-1.6-1.6v-6.3a1.6 1.6 0 0 1 1.6-1.6z M33.5 32.5v-1.6a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.6 M29.5 36.5h13",
  plane: "M36 29.5c.9 0 1.4.8 1.4 1.8v3.4l5.6 3.3v1.7l-5.6-1.7v3.3l1.7 1.3v1.3L36 42.9l-3.1.9v-1.3l1.7-1.3v-3.3L29 39.6v-1.7l5.6-3.3v-3.4c0-1 .5-1.8 1.4-1.8z",
  gift: "M30 34.8h12v6.7a1 1 0 0 1-1 1H31a1 1 0 0 1-1-1z M30 31.8h12a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H30a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1z M36 31.8v10.7 M36 31.8c-1.6-.1-3.2-1-2.6-2 .7-1 2.2 0 2.6 2z M36 31.8c1.6-.1 3.2-1 2.6-2-.7-1-2.2 0-2.6 2z",
  cake: "M31.5 35.5h9A1.5 1.5 0 0 1 42 37v5.5H30V37a1.5 1.5 0 0 1 1.5-1.5z M36 35.5v-3 M36 30.2c.8.8.8 1.5 0 2-.8-.5-.8-1.2 0-2z",
  cup: "M30.5 33.5h9v5a3.5 3.5 0 0 1-3.5 3.5h-2a3.5 3.5 0 0 1-3.5-3.5z M39.5 35h1.2a1.8 1.8 0 0 1 0 3.6h-1.2",
};

/** 뒤판(연한 색)·앞주머니(진한 색) */
export const COLOR_FILL: Record<FolderColor, { back: string; front: string }> = {
  mango: { back: "#FFE9A8", front: "#FFD15C" },
  pink: { back: "#FFDCE4", front: "#FFAFC0" },
  peach: { back: "#FFE1CC", front: "#FFB27F" },
  mint: { back: "#D8F1E0", front: "#93D6A8" },
  lavender: { back: "#E6E0FB", front: "#BBA9F2" },
  sky: { back: "#DAECFA", front: "#93C4EE" },
};

/** 화면에 넘기는 폴더 하나 */
export interface FolderView {
  id: string;
  name: string;
  icon: FolderIcon;
  color: FolderColor;
  /** 기본 폴더(가족·친구들·회사)는 이름을 못 바꾸고 못 지운다 */
  builtin: boolean;
  /** 들어 있는 사람(contactId, 사람들 목록 순서) */
  memberIds: string[];
}

/** 폴더 시트(만들기·고치기)에 넘기는 문구 */
export interface FolderSheetLabels {
  new: string;
  edit: string;
  name: string;
  namePlaceholder: string;
  icon: string;
  color: string;
  create: string;
  save: string;
  del: string;
  /** "{name} 폴더를 지울까요?…" */
  deleteConfirm: string;
  close: string;
  error: string;
  icons: Record<FolderIcon, string>;
  colors: Record<FolderColor, string>;
}

export function folderSheetLabels(t: T): FolderSheetLabels {
  return {
    new: t("folder.new"),
    edit: t("folder.edit"),
    name: t("folder.name"),
    namePlaceholder: t("folder.namePlaceholder"),
    icon: t("folder.icon"),
    color: t("folder.color"),
    create: t("folder.create"),
    save: t("folder.save"),
    del: t("folder.delete"),
    deleteConfirm: t("folder.deleteConfirm", { name: "{name}" }),
    close: t("common.close"),
    error: t("common.error"),
    icons: Object.fromEntries(FOLDER_ICONS.map((i) => [i, t(`folder.icon.${i}` as "folder.icon.heart")])) as Record<FolderIcon, string>,
    colors: Object.fromEntries(FOLDER_COLORS.map((c) => [c, t(`folder.color.${c}` as "folder.color.mango")])) as Record<FolderColor, string>,
  };
}
