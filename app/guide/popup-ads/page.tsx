import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Mail, MessageSquare } from "lucide-react";
import { fetchPagesSafe } from "@/lib/db/pages";
import { createClient } from "@/lib/supabase/server";
import { POPUP_AD as S, findEmail } from "@/lib/popupAdSpec";

export const dynamic = "force-dynamic"; // 문의 페이지에서 고친 이메일이 바로 반영되도록 캐시하지 않아요
export const metadata: Metadata = { title: "팝업 광고 문의 - JJabKit", description: "JJabKit(짭킷) 팝업 광고 안내: 이미지 규격, 노출 방식, 문의 방법" };

const h2 = "pt-6 text-base font-bold";
function Table({ label, rows }: { label: string; rows: [string, ReactNode][] }) {
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-line bg-card">
      <table className="w-full text-sm" aria-label={label}>
        <tbody className="divide-y divide-line">
          {rows.map(([k, v]) => (
            <tr key={k} className="align-top">
              <th scope="row" className="w-[34%] bg-bg px-3 py-2.5 text-left font-medium text-mute">{k}</th>
              <td className="break-words px-3 py-2.5">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 이용 안내 > 팝업 광고 문의. 읽기 전용 안내 페이지이고, 팝업 광고 기능 자체는 건드리지 않아요. */
export default async function PopupAdsPage() {
  const db = await createClient().catch(() => null);
  const contact = (await fetchPagesSafe(db)).contact;
  const email = findEmail(contact.body); // 문의 페이지에 이미 적혀 있는 주소만 써요
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-4">
      <Link href="/guide" className="inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-mute hover:text-brand">
        <ArrowLeft size={16} aria-hidden />이용 안내
      </Link>
      <h1 className="mt-2 font-serif text-2xl font-bold">팝업 광고 문의</h1>
      <p className="mt-2 text-sm leading-relaxed">짭킷 홈 화면에 광고를 게재하고 싶은 분을 위한 안내예요. 아래 규격과 노출 방식을 확인한 뒤 문의해 주세요.</p>

      <div className="text-sm leading-relaxed">
        <h2 className={h2}>1. 팝업 광고 안내</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>짭킷 서비스의 홈 화면에 처음 들어올 때 팝업으로 광고가 표시돼요.</li>
          <li>광고는 이미지와 짧은 문구(제목·설명·버튼)로 구성돼요. 광고 이미지와 문구는 광고주가 준비해 주세요.</li>
          <li>광고 게재를 원하시면 아래 &lsquo;문의 방법&rsquo;에 따라 먼저 문의해 주세요. 게재 여부와 내용은 문의 후 운영자가 확인해 안내해요.</li>
        </ul>

        <h2 className={h2}>2. 광고 이미지 제작 규격</h2>
        <Table label="광고 이미지 규격" rows={[
          ["이미지 비율", <><b>{S.ratioW} : {S.ratioH}</b> (가로 : 세로, 세로로 긴 모양)</>],
          ["화면 표시 크기", <>가로 최대 약 {S.displayW}px × 세로 약 {S.displayH}px (더 좁은 화면에서는 비율을 유지한 채 줄어들어요)</>],
          ["권장 제작 크기", <><b>{S.recommendW} × {S.recommendH}px</b> (표시 크기의 2배 안팎. 고해상도 화면에서도 선명하도록 이 크기 이상을 권장해요)</>],
          ["이미지 제출 방식", "광고 이미지는 이미지 파일(아래 형식)로 문의 시 전달해 주세요. 짭킷에는 광고주가 직접 올리는 업로드 기능이 없고, 운영자가 받은 이미지를 등록해요."],
          ["업로드 파일 형식", "JPG, PNG, WEBP 파일을 권장해요. 웹 브라우저가 표시할 수 있는 이미지면 되고, 짭킷이 형식을 따로 제한하지는 않아요. (동영상·PDF는 사용할 수 없어요)"],
          ["최대 파일 용량", "짭킷에서 정해 둔 용량 제한은 없어요. 다만 모바일에서도 빠르게 뜨도록 가볍게 만들어 주세요."],
        ]} />
        <p className="mt-3 font-medium">이미지 제작 시 유의사항</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>비율이 {S.ratioW}:{S.ratioH}이 아니면 가운데를 기준으로 가장자리가 잘려요. 핵심 내용은 가운데에 두세요.</li>
          <li>왼쪽 위에는 &lsquo;광고&rsquo; 표시(최대 {S.maxLabel}자), 오른쪽 위에는 닫기 버튼이 겹쳐 보여요. 두 모서리에는 중요한 내용을 두지 마세요.</li>
          <li>이미지 아래쪽에는 어두운 그라데이션과 함께 제목(최대 {S.maxTitle}자), 설명(최대 {S.maxBody}자), 버튼(버튼 글자 최대 {S.maxCta}자)이 글자로 올라가요. 이 부분에 중요한 내용이나 같은 문구를 넣으면 가려지거나 겹쳐 보여요.</li>
          <li>이미지 속 글자는 화면 읽기 프로그램이 읽지 못하고 이미지에 그라데이션이 덧씌워져요. 꼭 전달할 정보는 이미지가 아니라 제목·설명 문구로 넣어 주세요.</li>
          <li>이미지 없이 색 배경만으로도 게재할 수 있어요.</li>
        </ul>

        <h2 className={h2}>3. 광고 노출 방식</h2>
        <Table label="광고 노출 방식" rows={[
          ["표시 위치", "홈 화면(첫 화면) 위에 화면 가운데 팝업(레이어)으로 떠요. 다른 화면에서는 뜨지 않아요."],
          ["노출 시점", "홈 화면에 처음 들어올 때 한 번 떠요(같은 방문 중에는 다시 뜨지 않아요). 운영자가 정한 시작일~종료일 동안만 노출돼요."],
          ["여러 광고", "여러 개가 동시에 게재되면 한 장씩 넘겨 볼 수 있어요. 순서는 운영자가 정해요."],
          ["닫기", "X 버튼, 닫기 버튼, 팝업 바깥 영역, Esc 키로 닫을 수 있어요. '오늘 하루 동안 보지 않기'를 누르면 24시간 동안 다시 뜨지 않아요."],
          ["외부 링크", "지원해요. 광고를 누르면 광고주가 정한 외부 주소(http:// 또는 https://)가 새 창으로 열려요. 링크가 없으면 버튼 없이 이미지와 문구만 보여요."],
          ["모바일 · PC", "같은 모양으로 화면 가운데에 떠요. PC에서는 가로 최대 약 " + S.displayW + "px이고, 모바일에서는 화면 좌우 여백을 두고 화면 폭에 맞춰 줄어들어요."],
        ]} />
        <p className="mt-3 font-medium">현재 지원하지 않는 것</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>홈 화면 이외의 화면에 광고를 띄우는 것</li>
          <li>광고 노출 수·클릭 수 집계(광고 성과 보고)</li>
        </ul>

        <h2 className={h2}>4. 문의 방법</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>위의 이미지 규격을 확인하고 광고 이미지와 문구를 준비해 주세요.</li>
          <li>아래 문의 연락처로 팝업 광고 게재를 희망한다고 알려 주세요.</li>
          <li>광고 기간, 게재 일정, 광고비는 정해진 금액이 없고 문의 후 별도로 협의해요.</li>
        </ol>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/contact" className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-brand px-4 text-sm font-bold text-onbrand hover:opacity-90">
            <MessageSquare size={16} aria-hidden />문의 페이지로 이동
          </Link>
          {email && (
            <a href={`mailto:${email}?subject=${encodeURIComponent("[짭킷] 팝업 광고 문의")}`} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-line bg-card px-4 text-sm font-medium hover:bg-hit">
              <Mail size={16} aria-hidden />이메일로 문의 ({email})
            </a>
          )}
        </div>
        {!email && <p className="mt-2 text-xs text-mute">문의 페이지에 안내된 연락처로 문의해 주세요.</p>}
        <p className="mt-6 rounded-lg border border-line bg-bg p-3 text-xs text-mute">이 안내는 팝업 광고 게재 문의 전용이에요. 잘못된 공연 정보 신고나 서비스 이용 문의도 같은 문의 페이지로 보내 주시면 돼요.</p>
      </div>
    </div>
  );
}
