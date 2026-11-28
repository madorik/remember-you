import { enforceWebGate } from "@/lib/web-gate";

// 온보딩(첫 메모): 하단 메뉴 없이 메모지 한 장. 아래 여백은 메모지가 스스로 둔다(아래 막대 위로)
// 웹 브라우저는 가입하면 곧바로 앱 받기 화면으로(온보딩은 앱을 처음 열 때: 온보딩 전이면 앱이 온보딩을 보여 준다)
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  await enforceWebGate();
  return <main className="screen !pb-0">{children}</main>;
}
