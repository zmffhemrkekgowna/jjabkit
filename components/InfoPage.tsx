import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { fetchPagesSafe } from "@/lib/db/pages";
import { createClient } from "@/lib/supabase/server";
import type { PageSlug } from "@/types/page";

/** '## 소제목', '- 목록', 빈 줄 문단. 그 외는 글자 그대로(HTML 해석 없음). */
export function renderBody(body: string): ReactNode[] {
  const out: ReactNode[] = [];
  let list: string[] = [];
  let para: string[] = [];
  const flushList = () => { if (list.length) { const l = list; out.push(<ul key={`u${out.length}`} className="list-disc space-y-1 pl-5">{l.map((t, i) => <li key={i}>{t}</li>)}</ul>); list = []; } };
  const flushPara = () => { if (para.length) { const p = para; out.push(<p key={`p${out.length}`} className="whitespace-pre-line">{p.join("\n")}</p>); para = []; } };
  for (const raw of body.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) { flushList(); flushPara(); out.push(<h2 key={`h${out.length}`} className="pt-3 text-base font-bold">{line.slice(3)}</h2>); }
    else if (/^[-*] /.test(line)) { flushPara(); list.push(line.slice(2)); }
    else if (line.trim() === "") { flushList(); flushPara(); }
    else { flushList(); para.push(line); }
  }
  flushList(); flushPara();
  return out;
}

/** 안내 페이지 한 장을 그려요. 기본 3개와 관리자가 추가한 페이지가 같은 모양을 써요. 읽기 전용이라 수정·삭제 버튼은 없어요. */
export function InfoView({ title, body, updatedAt, back = { href: "/", label: "처음으로" } }: { title: string; body: string; updatedAt: string; back?: { href: string; label: string } }) {
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-4">
      <Link href={back.href} className="inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-mute hover:text-brand">
        <ArrowLeft size={16} aria-hidden />{back.label}
      </Link>
      <h1 className="mt-2 break-words font-serif text-2xl font-bold">{title}</h1>
      <div className="mt-4 space-y-3 break-words text-sm leading-relaxed">{renderBody(body)}</div>
      {updatedAt && <p className="mt-8 text-xs text-mute">마지막 수정 {updatedAt.slice(0, 10).replace(/-/g, ".")}</p>}
    </div>
  );
}

export default async function InfoPage({ slug }: { slug: PageSlug }) {
  const db = await createClient().catch(() => null);
  const page = (await fetchPagesSafe(db))[slug];
  return <InfoView title={page.title} body={page.body} updatedAt={page.updatedAt} back={{ href: "/guide", label: "이용 안내" }} />;
}
