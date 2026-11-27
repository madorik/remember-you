// 온보딩(첫 메모): 하단 메뉴 없이 메모지 한 장. 아래 여백은 메모지가 스스로 둔다(아래 막대 위로)
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <main className="screen !pb-0">{children}</main>;
}
