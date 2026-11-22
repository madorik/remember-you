import type { MetadataRoute } from "next";
import { LANDING_UPDATED_ON } from "@/lib/faq";
import { GUIDES, GUIDES_UPDATED } from "@/lib/guides";
import { LEGAL_EFFECTIVE_ON } from "@/lib/legal";
import { absoluteUrl } from "@/lib/site";

// 검색에 내보내는 주소: 시작 화면·선물 가이드·약관류. 수정일은 실제로 내용을 고친 날(시작 화면 lib/faq.ts, 가이드 lib/guides.ts, 약관류 legal-info)
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: absoluteUrl("/"), lastModified: LANDING_UPDATED_ON, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/gifts"), lastModified: GUIDES_UPDATED, changeFrequency: "weekly", priority: 0.9 },
    ...GUIDES.map((g) => ({ url: absoluteUrl(`/gifts/${g.slug}`), lastModified: GUIDES_UPDATED, changeFrequency: "weekly" as const, priority: 0.8 })),
    { url: absoluteUrl("/terms"), lastModified: LEGAL_EFFECTIVE_ON, changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy-policy"), lastModified: LEGAL_EFFECTIVE_ON, changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/support"), lastModified: LEGAL_EFFECTIVE_ON, changeFrequency: "yearly", priority: 0.2 },
  ];
}
