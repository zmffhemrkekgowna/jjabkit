/**
 * 포스터를 '이미지 주소(URL)'로 등록할 때 쓰는 검사.
 * - http:// · https:// 주소만 받아요(앞뒤 공백은 지워요).
 * - 브라우저에서 실제로 이미지로 불러와 봐서, 웹페이지 주소·삭제된 이미지·접근이 막힌 이미지는 걸러요.
 *   (사이트에서 포스터를 보여줄 때와 같은 방식으로 불러오므로, 미리보기에 보이면 사이트에서도 보여요.)
 * - GIF 주소는 움직이는 포스터가 되지 않도록 첫 장면만 PNG 파일로 바꿔서 '파일 업로드'로 넘겨요.
 */
import { POSTER_MAX_MB, firstFrameCanvas, isGifUrl } from "./posterFile";

export const POSTER_URL_MAX = 2000;
const LOAD_TIMEOUT_MS = 15000;

/** 공백을 지우고 http(s) 주소인지 검사해요. 괜찮으면 { url }, 아니면 { error } */
export function normalizePosterUrl(raw: string): { url: string; error?: undefined } | { url?: undefined; error: string } {
  const t = (raw ?? "").trim();
  if (!t) return { error: "이미지 주소를 입력해 주세요." };
  if (t.length > POSTER_URL_MAX) return { error: "주소가 너무 길어요. 이미지 자체의 주소를 넣어 주세요." };
  if (/\s/.test(t)) return { error: "주소 중간에 띄어쓰기가 있어요. 주소를 다시 복사해 넣어 주세요." };
  let u: URL;
  try { u = new URL(t); } catch { return { error: "올바른 주소 형식이 아니에요. http:// 또는 https://로 시작하는 이미지 주소를 넣어 주세요." }; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return { error: "http:// 또는 https://로 시작하는 주소만 쓸 수 있어요." };
  if (!u.hostname) return { error: "올바른 주소 형식이 아니에요." };
  return { url: u.href };
}

export const URL_LOAD_FAIL = "이미지를 불러오지 못했어요. 웹페이지 주소가 아니라 이미지 자체의 주소인지, 삭제되었거나 접근이 막힌 이미지는 아닌지 확인해 주세요.";

/** 주소를 실제 이미지로 불러와 봐요. 이미지가 아니거나(웹페이지 등) 못 불러오면 에러를 던져요. */
export function loadImageUrl(url: string, timeoutMs = LOAD_TIMEOUT_MS): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let done = false;
    const finish = (err?: string) => {
      if (done) return; done = true; clearTimeout(timer);
      img.onload = img.onerror = null;
      if (err) reject(new Error(err)); else resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    const timer = setTimeout(() => { img.src = ""; finish("이미지를 불러오는 데 시간이 너무 오래 걸려요. 주소를 확인하거나 파일로 올려 주세요."); }, timeoutMs);
    img.onload = () => (img.naturalWidth > 0 && img.naturalHeight > 0 ? finish() : finish(URL_LOAD_FAIL));
    img.onerror = () => finish(URL_LOAD_FAIL);
    img.src = url;
  });
}

/** GIF 주소 → 첫 장면만 담은 PNG 파일. 그 사이트가 그림 읽기를 막아 두면(CORS) 바꿀 수 없어 에러를 던져요. */
export async function gifUrlToStaticFile(url: string): Promise<File> {
  let cv: HTMLCanvasElement;
  try { cv = await firstFrameCanvas(url); } catch { throw new Error("GIF 주소는 정지 이미지로 바꿀 수 없어서 등록할 수 없어요(그 사이트가 이미지 변환을 막아 두었어요). GIF를 내려받아 파일로 올려 주세요."); }
  let blob: Blob | null = null;
  try { blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png")); } catch { blob = null; }
  if (!blob) throw new Error("GIF 주소는 정지 이미지로 바꿀 수 없어서 등록할 수 없어요(그 사이트가 이미지 변환을 막아 두었어요). GIF를 내려받아 파일로 올려 주세요.");
  if (blob.size > POSTER_MAX_MB * 1024 * 1024) throw new Error(`정지 이미지로 바꾼 크기가 ${POSTER_MAX_MB}MB를 넘어요. 더 작은 GIF로 올려 주세요.`);
  const base = (new URL(url).pathname.split("/").pop() || "poster").replace(/\.[^.]+$/, "") || "poster";
  return new File([blob], `${base}.png`, { type: "image/png" });
}

/**
 * 입력한 주소를 검사해 포스터로 쓸 결과를 돌려줘요.
 * - 일반 이미지: { url } — 저장하면 공연의 포스터 주소(img)로 그대로 들어가요(파일 업로드 없음).
 * - GIF 주소: { file } — 첫 장면 PNG 파일. 저장할 때 기존 파일 업로드와 똑같이 Storage에 올라가요.
 */
export async function resolvePosterUrl(raw: string): Promise<{ url: string; file?: undefined } | { file: File; url?: undefined }> {
  const n = normalizePosterUrl(raw);
  if (n.error !== undefined) throw new Error(n.error);
  await loadImageUrl(n.url);
  if (isGifUrl(n.url)) return { file: await gifUrlToStaticFile(n.url) };
  return { url: n.url };
}
