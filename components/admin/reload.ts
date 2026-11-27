"use client";

import { createContext, useContext } from "react";

/** 관리자 데이터 다시 불러오기(AdminData가 제공, 저장 성공 후 useAdminRun이 불러요). 제공자 밖이면 null. */
export const AdminReloadContext = createContext<(() => Promise<void>) | null>(null);
export const useAdminReload = () => useContext(AdminReloadContext);
