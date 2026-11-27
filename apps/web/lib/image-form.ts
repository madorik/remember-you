import { IMAGE_MAX_BYTES, IMAGE_MAX_COUNT, checkJpegBytes } from "@readme/core";

/**
 * 폼(FormData)의 image 파일들을 AI에 보낼 JPEG data URL로 만든다. 한 장 이상 IMAGE_MAX_COUNT장까지, 한 장이라도
 * 문자열이거나 너무 크거나 앱이 줄여 만든 JPEG 모양(core checkJpegBytes)이 아니면 null(AI에 보내기 전에 거절). 사진은 저장하지 않는다
 */
export async function jpegDataUrls(form: unknown): Promise<string[] | null> {
  if (!(form instanceof FormData)) return null;
  const entries = form.getAll("image");
  if (entries.length < 1 || entries.length > IMAGE_MAX_COUNT) return null;
  const photos: string[] = [];
  for (const e of entries) {
    // 문자열이거나 파일이 아니면, 너무 크면(읽어 들이기 전에) 거절
    if (typeof e === "string" || typeof (e as Blob).arrayBuffer !== "function" || (e as Blob).size > IMAGE_MAX_BYTES) return null;
    const bytes = new Uint8Array(await (e as Blob).arrayBuffer());
    if (!checkJpegBytes(bytes).ok) return null;
    photos.push(`data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`);
  }
  return photos;
}
