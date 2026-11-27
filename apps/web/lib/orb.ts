// 체험(말로 적기 VoiceCapture)에서 듣는 중임을 알리는 표시. 아래 메뉴 가운데 구슬(CharOrb)은 메모 단추로 바뀌어 지금은 이 표시를 받아 그리는 것이 없다(호출은 무해).
//  · <html data-listening>: 듣는 동안만 켠다
//  · --mic(0~1): 마이크 소리 크기. [data-orb] 요소 하나에만 넣는다(문서 전체에 넣으면 프레임마다 모든 요소의 스타일을 다시 셈한다)
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
