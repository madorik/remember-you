// 앱 화면이 서버에서 올 동안 보이는 뼈대: 글자 없이 모양만(제목 줄 + 카드 몇 장).
// 화면마다 아래 여백을 스스로 갖는 틀이라 여기서도 .page-end로 끝이 가려지지 않게
export default function AppLoading() {
  const block = "motion-safe:animate-pulse";
  return (
    <div aria-busy="true" className="page-end flex flex-1 flex-col gap-3.5 px-4 pt-4">
      <div className={`${block} h-8 w-40 rounded-xl bg-rule`} />
      <div className={`${block} h-44 rounded-[21.6px] bg-white`} />
      <div className={`${block} h-28 rounded-[21.6px] bg-white`} />
      <div className={`${block} h-28 rounded-[21.6px] bg-white`} />
    </div>
  );
}
