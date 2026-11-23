/**
 * 화면 전체 90%(시안 D+A): 숫자로 크기를 받는 그림 조각(얼굴·캐릭터·폴더·아이콘·테이프 …)이 받은 값에 이 배율을 곱해 그린다.
 * 같은 90%를 Tailwind 간격은 app/globals.css의 --spacing(0.225rem)이, px로 적은 클래스(text-[..px] 등)는 0.9배한 값이 맡는다.
 * 글자는 글꼴이 바뀌면서 크기가 따로 보정돼 있다(globals.css의 글꼴 설명).
 */
export const UI = 0.9;

/** 크기(px)를 90%로. 소수 첫째 자리까지 */
export function u(n: number): number {
  return Math.round(n * UI * 10) / 10;
}
