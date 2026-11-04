import type { Metadata } from "next";
import type { Show } from "@/types/show";
import { STATUS_LABEL, statusOf } from "./status";

/** 공연 한 편의 링크 미리보기(제목·설명·포스터)를 만들어요. 순수 함수라서 따로 테스트할 수 있어요. */
export function showMetadata(show: Show): Metadata {
  const title = `${show.title} 캐스팅 일정`;
  const period = show.start ? `${show.start}${show.end ? ` ~ ${show.end}` : ""}` : "";
  const parts = [show.genre, (() => { const st = statusOf(show); return st ? STATUS_LABEL[st] : ""; })(), show.venue, period].filter(Boolean);
  const description = `${parts.join(" · ")}${parts.length ? " — " : ""}회차별 출연 배우를 달력으로 확인해 보세요.`;
  // 포스터는 http(s) 주소일 때만 써요. (data: 주소 등은 미리보기에 쓸 수 없어요)
  const images = /^https?:\/\//i.test(show.img) ? [{ url: show.img, alt: `${show.title} 포스터` }] : undefined;
  return {
    title,
    description,
    openGraph: { title: `${title} | JJabKit`, description, type: "website", siteName: "JJabKit", locale: "ko_KR", images },
    twitter: { card: images ? "summary_large_image" : "summary", title: `${title} | JJabKit`, description, images: images?.map((i) => i.url) },
  };
}
