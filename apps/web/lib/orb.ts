// 말로 적기에서 듣는 중임을 아래 메뉴 가운데 구슬(components/CharOrb.tsx)에 알린다.
//  · <html data-listening>: 듣는 동안만 켠다. CSS(globals.css의 :root[data-listening] .orb-wrap)가 구슬을 활발하게 바꾼다
//  · --mic(0~1): 마이크 소리 크기. 구슬([data-orb]) 하나에만 넣는다(문서 전체에 넣으면 프레임마다 모든 요소의 스타일을 다시 셈한다)
// 화면을 떠나거나 멈추면 반드시 setOrbListening(false)로 끈다.

let orb: HTMLElement | null = null;

export function setOrbListening(on: boolean): void {
  if (typeof document === "undefined") return;
  if (on) document.documentElement.dataset.listening = "1";
  else {
    delete document.documentElement.dataset.listening;
    setOrbLevel(0);
  }
}

export function setOrbLevel(level: number): void {
  if (typeof document === "undefined") return;
  if (!orb?.isConnected) orb = document.querySelector<HTMLElement>("[data-orb]");
  orb?.style.setProperty("--mic", level.toFixed(3));
}
