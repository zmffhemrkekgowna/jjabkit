"use client";

import { useState } from "react";
import { useDirty } from "./dirty";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { RESERVED_SLUGS, SLUG_RE, PAGE_SLUGS, type CustomPage, type PageSlug, type SitePage } from "@/types/page";
import { PAGE_DEFAULTS } from "@/lib/pageDefaults";
import { createPage, deletePage, resetPage, savePage } from "@/lib/db/pages";
import { Fld, Sec, btn, ghost, inp, useAdminRun } from "./shared";

type PageRow = { slug: string; title: string; body: string; updatedAt: string; custom: boolean };
const URL_OF = (slug: string) => (PAGE_SLUGS.includes(slug as PageSlug) ? `/${slug}` : `/guide/${slug}`);
const isBuiltin = (slug: string): slug is PageSlug => PAGE_SLUGS.includes(slug as PageSlug);

/** 한 페이지의 제목·내용 수정. 기본 3개는 '기본 문구로 되돌리기', 추가한 페이지는 '삭제'가 있어요. */
function Editor({ page, builtin }: { page: PageRow; builtin: boolean }) {
  const { run, msg, setMsg } = useAdminRun();
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [confirmReset, setConfirmReset] = useState(false);
  const t = title.trim();
  const problem = !t || t.length > 60 ? "제목을 1~60자로 입력해 주세요." : body.length > 20000 ? "내용은 20000자까지예요." : "";
  const dirty = t !== page.title || body.trim() !== page.body.trim();
  const slug = page.slug;
  useDirty(`page-${slug}`, `안내 페이지 수정(${page.title})`, dirty);

  return (
    <Sec title={`${page.title} (${URL_OF(slug)})`} right={<span className="text-xs text-mute">{builtin ? (page.custom ? "직접 수정함" : "기본 문구") : "추가한 페이지"}</span>}>
      <div className="space-y-3">
        <Fld label={`제목 (${t.length}/60)`}><input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} className={inp} /></Fld>
        <Fld label={`내용 (${body.length}/20000)`}><textarea value={body} maxLength={20000} rows={builtin ? 14 : 10} onChange={(e) => setBody(e.target.value)} className={`${inp} font-mono leading-relaxed`} /></Fld>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} disabled={!!problem || !dirty}
            onClick={async () => { if (problem) { setMsg(problem); return; } await run((db) => savePage(db, slug, title, body), "저장했어요."); }}>
            <Save size={14} aria-hidden />저장
          </button>
          <a href={URL_OF(slug)} target="_blank" rel="noopener noreferrer" className={ghost}>페이지 열어 보기</a>
          {(!builtin || page.custom) && (confirmReset ? (
            <>
              <button className={btn} onClick={async () => {
                if (builtin && isBuiltin(slug)) {
                  const ok = await run((db) => resetPage(db, slug), "기본 문구로 되돌렸어요.");
                  if (ok) { setTitle(PAGE_DEFAULTS[slug].title); setBody(PAGE_DEFAULTS[slug].body); setConfirmReset(false); }
                } else {
                  await run((db) => deletePage(db, slug), "안내 페이지를 삭제했어요. 사용자 화면에서도 사라져요.");
                }
              }}>{builtin ? "되돌리기 확인" : "삭제 확인"}</button>
              <button className={ghost} onClick={() => setConfirmReset(false)}>취소</button>
            </>
          ) : builtin
            ? <button className={ghost} onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden />기본 문구로 되돌리기</button>
            : <button className={ghost} onClick={() => setConfirmReset(true)}><Trash2 size={14} aria-hidden />페이지 삭제</button>)}
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg || (problem && title ? problem : "")}</p>
      </div>
    </Sec>
  );
}

/** 새 안내 페이지 만들기: 제목, 주소(영문), 내용. 만들면 사용자 화면 '이용 안내' 목록에 바로 나와요. */
function NewPage() {
  const { run, msg, setMsg } = useAdminRun();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [body, setBody] = useState("");
  const t = title.trim(), sl = slug.trim().toLowerCase();
  useDirty("page-new", "새 안내 페이지 입력", !!(title || slug || body));
  const problem = !t || t.length > 60 ? "제목을 1~60자로 입력해 주세요."
    : !sl ? "주소를 영문 소문자·숫자·하이픈으로 입력해 주세요. 예: faq"
    : !SLUG_RE.test(sl) ? "주소는 영문 소문자·숫자·하이픈(-)만 쓸 수 있고 40자까지예요. 예: faq, ticket-guide"
    : RESERVED_SLUGS.includes(sl) ? "이미 쓰는 주소예요. 다른 주소를 입력해 주세요."
    : body.length > 20000 ? "내용은 20000자까지예요." : "";
  return (
    <Sec title="새 안내 페이지 만들기">
      <div className="space-y-3">
        <Fld label={`제목 (${t.length}/60)`}><input value={title} maxLength={60} onChange={(e) => { setTitle(e.target.value); setMsg(""); }} placeholder="예: 자주 묻는 질문" className={inp} /></Fld>
        <Fld label="주소 (영문 소문자·숫자·하이픈)"><input value={slug} maxLength={40} onChange={(e) => { setSlug(e.target.value); setMsg(""); }} placeholder="예: faq" className={inp} /></Fld>
        {SLUG_RE.test(sl) && <p className="text-xs text-mute">사용자 화면 주소: /guide/{sl}</p>}
        <Fld label={`내용 (${body.length}/20000)`}><textarea value={body} maxLength={20000} rows={8} onChange={(e) => { setBody(e.target.value); setMsg(""); }} className={`${inp} font-mono leading-relaxed`} /></Fld>
        <div className="flex flex-wrap items-center gap-2">
          <button className={btn} disabled={!!problem}
            onClick={async () => {
              if (problem) { setMsg(problem); return; }
              const ok = await run((db) => createPage(db, sl, title, body), `안내 페이지를 만들었어요. 사용자 화면 '이용 안내'에 나와요. (/guide/${sl})`);
              if (ok) { setTitle(""); setSlug(""); setBody(""); }
            }}>
            <Plus size={14} aria-hidden />페이지 만들기
          </button>
        </div>
        <p aria-live="polite" className="min-h-5 text-sm text-brand">{msg || (problem && (title || slug) ? problem : "")}</p>
      </div>
    </Sec>
  );
}

/** 안내 페이지 관리. 여기서 등록·수정·삭제한 내용이 사용자 화면의 '이용 안내'(/guide)에 그대로 나와요. */
export default function PagesAdmin({ pages, customPages = [] }: { pages: Record<PageSlug, SitePage & { custom: boolean }>; customPages?: CustomPage[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-mute">
        여기서 만든 안내 페이지는 사용자 화면 위쪽의 <b>이용 안내</b> 메뉴(책 아이콘)와 화면 맨 아래 링크에서 누구나 볼 수 있어요. 사용자는 읽기만 할 수 있어요.
        소개·개인정보처리방침·문의는 기본 페이지라 삭제할 수 없고 문구만 고쳐요. <b>(…을 입력해 주세요)</b> 부분은 꼭 직접 고쳐 주세요(이메일, 시행일).
        줄 앞에 <code>## </code>를 붙이면 소제목, <code>- </code>를 붙이면 목록이 되고, 빈 줄은 문단 구분이에요. 내용은 글자 그대로 보여요.
        개인정보처리방침은 일반적인 예시 문구라, 실제 운영 상황(사용하는 서비스, 광고 등)에 맞는지 확인해 주세요.
      </p>
      <NewPage />
      {customPages.length > 0 && <h2 className="pt-2 text-sm font-bold">추가한 안내 페이지 <span className="font-normal text-mute">{customPages.length}개</span></h2>}
      {customPages.map((p) => <Editor key={p.slug} page={{ ...p, custom: true }} builtin={false} />)}
      <h2 className="pt-2 text-sm font-bold">기본 안내 페이지</h2>
      {PAGE_SLUGS.map((s) => <Editor key={s} page={pages[s]} builtin />)}
    </div>
  );
}
