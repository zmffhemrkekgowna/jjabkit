/** 관리자 화면의 탭 목록. 서버 페이지(app/admin)가 쓰므로 "use client" 파일이 아닌 곳에 둬요. */
export type Tab = "shows" | "popups" | "notices" | "pages" | "backup";
export const TAB_IDS: Tab[] = ["shows", "popups", "notices", "pages", "backup"];
