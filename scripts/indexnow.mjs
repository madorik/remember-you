// IndexNow: 공개 페이지 주소를 검색엔진(네이버·빙 등)에 바로 알린다. 소유 확인 없이 키 파일만으로 된다.
// 키 파일은 apps/web/public/<KEY>.txt(→ https://remember-you.watalabs.com/<KEY>.txt, proxy가 로그인 없이 열어 둔다). 키를 바꾸면 그 파일도 바꾼다.
// 운영 배포 뒤에 실행: pnpm indexnow (사이트맵 주소 전부). 주소를 직접 주면 그것만: pnpm indexnow https://remember-you.watalabs.com/gifts/partner
// 네이버는 자기 주소로 직접, 빙·얀덱스 등은 공용 주소(api.indexnow.org)가 나눠 준다
const KEY = "05ba488fecb7c763493885eb3f7f4492";
const HOST = "remember-you.watalabs.com";
const SITEMAP = `https://${HOST}/sitemap.xml`;
const ENDPOINTS = ["https://searchadvisor.naver.com/indexnow", "https://api.indexnow.org/indexnow"];

async function sitemapUrls() {
  const res = await fetch(SITEMAP);
  if (!res.ok) throw new Error(`${SITEMAP}: ${res.status}`);
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

const urlList = process.argv.length > 2 ? process.argv.slice(2) : await sitemapUrls();
let failed = false;
for (const endpoint of ENDPOINTS) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
  });
  // 200·202면 받은 것. 403은 키 파일을 못 읽은 것(배포 전이거나 주소가 다름), 422는 주소가 host와 다름
  console.log(`${endpoint} ${res.status} ${res.statusText}: 주소 ${urlList.length}개`);
  if (!res.ok) {
    failed = true;
    console.log(await res.text());
  }
}
if (failed) process.exit(1);
