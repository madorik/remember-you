// 메모 본문 뒤에 글 한 덩이를 잇는다(공유로 받은 글·사진에서 읽은 글이 같이 쓴다)

/**
 * 쓰던 글이 있으면 빈 줄 하나를 띄우고 뒤에 붙이고, 비어 있으면 그 글로 채운다.
 * 합쳐 max자를 넘으면 앞에서부터 max자만 담고 clipped=true
 */
export function appendBlock(current: string, add: string, max: number): { text: string; clipped: boolean } {
  const block = add.trim();
  if (!block) return { text: current, clipped: false };
  const joined = current.trim() ? `${current.replace(/\s+$/, "")}\n\n${block}` : block;
  return { text: joined.slice(0, max), clipped: joined.length > max };
}
