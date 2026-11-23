// 앱 글꼴 두 벌(OFL)을 직접 호스팅한다.
//   · 포어스토리(Poor Story) 400 = 손글씨(제목·단추·숫자·사람이 적은 글). 구글 폰트의 한글 조각(unicode-range) 파일을 public/fonts에 받아 둔다. 굵기는 400 한 벌뿐이라 굵게는 만들지 않는다
//   · 눈누 기초고딕(Noonnu Basic Gothic) Regular = 앱 글(라벨·질문·칩·탭 이름). 눈누(noonnu.cc)가 jsdelivr로 내는 woff2 한 개(238KB, 한글 2,780자)를 그대로 받는다
// 브라우저는 화면에 나온 글자의 조각만 받는다. 빌드·개발 서버가 구글 폰트를 부르지 않고, 사용자 IP도 구글로 가지 않는다.
// 글꼴에 없는 드문 글자는 CSS의 대체 글꼴(--font-hand·--font-sans)로 넘어간다.
//   node scripts/fetch-fonts.mjs   (글꼴을 바꿀 때만 다시 돌린다. 로고 글자만 담은 작은 파일은 scripts/fetch-wordmark-font.mjs)
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const FONTS = [{ family: "Poor Story", weights: "400", dir: "poor-story" }];
const NOONNU = {
  family: "Noonnu Basic Gothic",
  dir: "noonnu-basic-gothic",
  file: "NoonnuBasicGothicRegular.woff2",
  url: "https://cdn.jsdelivr.net/gh/projectnoonnu/noon-2410@1.0/NoonnuBasicGothicRegular.woff2",
  md5: "340883ed94d9ac6b1ca20a12900f342c",
};
const root = resolve(import.meta.dirname, "../apps/web");
const cssPath = resolve(root, "app/fonts.css");
// woff2 + unicode-range를 주는 최신 브라우저로 보이게
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// 예전에 쓰던 글꼴(개구·고운돋움)은 이제 쓰지 않으니 같이 지운다
for (const old of ["gaegu", "gowun-dodum"]) rmSync(resolve(root, `public/fonts/${old}`), { recursive: true, force: true });

const out = [];
const jobs = [];
for (const { family, weights, dir } of FONTS) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weights}&display=swap`;
  const css = await (await fetch(url, { headers: { "user-agent": UA } })).text();
  if (!css.includes("@font-face")) throw new Error(`no @font-face in response for ${family}`);
  const outDir = resolve(root, `public/fonts/${dir}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const multi = weights.includes(";");
  const seen = new Map();
  for (const m of css.matchAll(/(?:\/\*\s*([^*]*?)\s*\*\/\s*)?@font-face\s*{([^}]*)}/g)) {
    const label = (m[1] ?? `x${seen.size}`).replace(/[^\w]+/g, "");
    const face = m[2];
    const weight = /font-weight:\s*([\d ]+);/.exec(face)?.[1]?.trim();
    const src = /url\((https:[^)]+\.woff2)\)/.exec(face)?.[1];
    const range = /unicode-range:\s*([^;]+);/.exec(face)?.[1];
    if (!weight || !src || !range) continue;
    // 같은 파일을 여러 번 받지 않는다. 이름은 [굵기-]조각번호(한글은 숫자, 라틴 등은 이름표)
    let name = seen.get(src);
    if (!name) {
      const slice = /\.(\d+)\.woff2$/.exec(src)?.[1] ?? label;
      name = `${multi ? `${weight}-` : ""}${slice}.woff2`;
      seen.set(src, name);
      jobs.push({ src, file: resolve(outDir, name) });
    }
    out.push(`@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:swap;src:url(/fonts/${dir}/${name}) format("woff2");unicode-range:${range.trim()}}`);
  }
}

// 동시에 8개씩, 실패하면 세 번까지 다시
let done = 0;
async function worker() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(job.src, { headers: { "user-agent": UA } });
        if (!res.ok) throw new Error(`${res.status} ${job.src}`);
        writeFileSync(job.file, Buffer.from(await res.arrayBuffer()));
        done++;
        break;
      } catch (e) {
        if (attempt >= 3) throw e;
      }
    }
  }
}
const total = jobs.length;
await Promise.all(Array.from({ length: 8 }, worker));

// 눈누 기초고딕: 파일 하나. 내려받은 파일이 달라졌으면(글꼴이 새로 나왔으면) 멈추고 알린다
{
  const res = await fetch(NOONNU.url);
  if (!res.ok) throw new Error(`${res.status} ${NOONNU.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const md5 = createHash("md5").update(buf).digest("hex");
  if (md5 !== NOONNU.md5) throw new Error(`${NOONNU.file} changed (md5 ${md5}); check the font and update NOONNU.md5`);
  const outDir = resolve(root, `public/fonts/${NOONNU.dir}`);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(resolve(outDir, NOONNU.file), buf);
  out.push(`@font-face{font-family:"${NOONNU.family}";font-style:normal;font-weight:400;font-display:swap;src:url(/fonts/${NOONNU.dir}/${NOONNU.file}) format("woff2")}`);
}

writeFileSync(cssPath, `/* scripts/fetch-fonts.mjs 로 만든 파일(${[...FONTS.map((f) => f.family), NOONNU.family].join(", ")}; SIL Open Font License 1.1). 손으로 고치지 않는다 */\n${out.join("\n")}\n`);
console.log(`${done}/${total} files, ${out.length} faces\nwrote ${cssPath}`);
