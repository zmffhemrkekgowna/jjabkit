/**
 * 공연 포스터 파일 검사와 '정지 이미지' 변환.
 * - 올릴 수 있는 형식: JPG·JPEG·PNG·WEBP·GIF·AVIF·BMP (8MB 이하)
 * - GIF는 움직이는 포스터가 아니라 '형식만 GIF인 정지 포스터'로 다뤄요. 올리는 순간 첫 프레임만 뽑아 PNG로 바꿔 저장하므로,
 *   사용자 화면·공연 목록·상세 어디서도 움직이지 않아요(원본 GIF는 저장하지 않아요).
 */
export const POSTER_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp"] as const;
export const POSTER_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", avif: "image/avif", bmp: "image/bmp",
};
const TYPE_ALIASES: Record<string, string> = { "image/jpg": "image/jpeg", "image/pjpeg": "image/jpeg", "image/x-png": "image/png", "image/x-ms-bmp": "image/bmp", "image/x-bmp": "image/bmp" };
export const POSTER_TYPES = [...new Set(Object.values(POSTER_TYPE_BY_EXT))];
export const POSTER_MAX_MB = 8;
export const POSTER_ACCEPT = [...POSTER_EXTS.map((e) => `.${e}`), ...POSTER_TYPES].join(",");
export const POSTER_LABEL = "JPG·JPEG·PNG·WEBP·GIF·AVIF·BMP";
const GIF_MAX_SIDE = 4096; // 첫 프레임을 그릴 때 한 변의 최대 길이

const extOf = (name: string) => (name.split(".").pop() || "").toLowerCase();
/** 파일의 실제 형식(MIME). 브라우저가 형식을 비워 두는 경우(BMP·AVIF 등)는 확장자로 알아내요. */
export function posterTypeOf(f: { name: string; type: string }): string {
  const t = (f.type || "").toLowerCase();
  return TYPE_ALIASES[t] ?? (t || POSTER_TYPE_BY_EXT[extOf(f.name)] || "");
}
export const isGifFile = (f: { name: string; type: string }) => posterTypeOf(f) === "image/gif" || extOf(f.name) === "gif";
export const isGifUrl = (url: string) => /\.gif(?:[?#].*)?$/i.test(url.trim());

/** 형식·크기 검사. 문제가 있으면 안내 문구를, 괜찮으면 빈 문자열을 돌려줘요. */
export function posterFileProblem(f: { name: string; type: string; size: number }): string {
  const ext = extOf(f.name);
  const t = posterTypeOf(f);
  const extOk = (POSTER_EXTS as readonly string[]).includes(ext);
  const typeOk = POSTER_TYPES.includes(t);
  if (!extOk || !typeOk || (f.type && POSTER_TYPE_BY_EXT[ext] && t !== POSTER_TYPE_BY_EXT[ext])) return `${POSTER_LABEL} 이미지 파일만 올릴 수 있어요.`;
  if (f.size > POSTER_MAX_MB * 1024 * 1024) return `이미지가 너무 커요. ${POSTER_MAX_MB}MB 이하로 줄여서 올려 주세요.`;
  return "";
}

type Frame = { width: number; height: number } & CanvasImageSource;
async function decode(src: Blob | string): Promise<Frame> {
  if (typeof src !== "string" && typeof createImageBitmap === "function") {
    try { return await createImageBitmap(src); } catch { /* 아래 <img> 방식으로 다시 시도 */ }
  }
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    if (typeof src === "string") img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    return img;
  } finally { if (typeof src !== "string") URL.revokeObjectURL(url); }
}

/** GIF(또는 아무 이미지)의 첫 프레임을 PNG로 그려서 돌려줘요. 투명한 부분은 그대로 투명해요. */
export async function firstFrameCanvas(src: Blob | string): Promise<HTMLCanvasElement> {
  const frame = await decode(src);
  const w0 = frame.width, h0 = frame.height;
  if (!w0 || !h0) throw new Error("이미지 크기를 알 수 없어요.");
  const k = Math.min(1, GIF_MAX_SIDE / Math.max(w0, h0));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w0 * k)); cv.height = Math.max(1, Math.round(h0 * k));
  const ctx = cv.getContext("2d");
  if (!ctx) throw new Error("이 브라우저에서는 이미지를 변환할 수 없어요.");
  ctx.drawImage(frame, 0, 0, cv.width, cv.height);
  if ("close" in frame && typeof (frame as ImageBitmap).close === "function") (frame as ImageBitmap).close();
  return cv;
}

/**
 * 올리기 직전 변환: GIF면 첫 프레임만 담은 PNG 파일로 바꿔요(이름의 .gif → .png). 다른 형식은 그대로 돌려줘요.
 * 변환에 실패하면 에러를 던져요 — 움직이는 GIF가 그대로 저장되는 일은 없어요.
 */
export async function toStaticPoster(file: File): Promise<File> {
  if (!isGifFile(file)) return file;
  let cv: HTMLCanvasElement;
  try { cv = await firstFrameCanvas(file); } catch { throw new Error("GIF를 정지 이미지로 바꾸지 못했어요. 다른 파일로 올려 주세요."); }
  const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/png"));
  if (!blob) throw new Error("GIF를 정지 이미지로 바꾸지 못했어요. 다른 파일로 올려 주세요.");
  if (blob.size > POSTER_MAX_MB * 1024 * 1024) throw new Error(`정지 이미지로 바꾼 크기가 ${POSTER_MAX_MB}MB를 넘어요. 더 작은 GIF로 올려 주세요.`);
  const base = file.name.replace(/\.[^./\\]+$/, "") || "poster";
  return new File([blob], `${base}.png`, { type: "image/png", lastModified: file.lastModified });
}
