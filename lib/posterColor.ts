/**
 * 포스터 이미지에서 '대표 색상' 후보를 뽑아요. (브라우저 안에서만 계산하고, 이미지를 어디로 보내지 않아요)
 *  - 평균 색을 쓰지 않아요. 색상(hue)별로 면적을 모아서 비중이 큰 색을 골라요.
 *  - 흰색·검은색·회색 같은 무채색은 대표 색에서 빼요. 가장자리(배경이 되기 쉬운 곳)는 비중을 낮춰요.
 *  - 고른 색은 달력 카드 바탕으로 쓰기 좋게 채도·명도를 보정해요(너무 밝거나 흐리지 않게, 글자와 4.5:1 이상 대비).
 */

export const COLOR_MAX_SIDE = 96; // 분석용 축소 크기(긴 변)

type Rgb = [number, number, number];

const toHex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const fromHex = (h: string): Rgb => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as Rgb;

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return [h, s, l];
}
function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}
const lum = ([r, g, b]: Rgb) => {
  const ch = [r, g, b].map((v) => v / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
};
/** 흰 글자와의 대비(1~21) */
export const contrastWhite = (hex: string) => 1.05 / (lum(fromHex(hex)) + 0.05);

/** 달력 카드 바탕으로 쓰기 좋게 보정: 채도 0.30~0.62, 명도 0.30~0.46, 그리고 흰 글자 대비 4.5 이상. */
export function tuneForSchedule(hex: string): string {
  const [h, s0, l0] = rgbToHsl(fromHex(hex));
  const s = Math.min(0.62, Math.max(0.3, s0));
  let l = Math.min(0.46, Math.max(0.3, l0));
  let out = toHex(hslToRgb(h, s, l));
  for (let i = 0; i < 20 && contrastWhite(out) < 4.5; i++) { l -= 0.01; out = toHex(hslToRgb(h, s, l)); }
  return out;
}

export interface Candidate { hex: string; share: number /* 0~1, 색이 있는 부분 중 비중 */ }

/**
 * RGBA 픽셀(width×height)에서 대표 색 후보를 비중 순으로 최대 `max`개 돌려줘요. 무채색뿐이면 빈 배열이에요.
 * 순수 함수라 이미지 없이도 테스트할 수 있어요.
 */
export function extractCandidates(data: ArrayLike<number>, width: number, height: number, max = 4): Candidate[] {
  const BINS = 18; // 색상 20°씩
  const acc = Array.from({ length: BINS }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  let total = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue; // 투명
      const rgb: Rgb = [data[i], data[i + 1], data[i + 2]];
      const [h, s, l] = rgbToHsl(rgb);
      if (s < 0.22 || l < 0.12 || l > 0.9) continue; // 회색·검정·흰색 계열은 대표 색에서 제외
      // 가운데일수록 비중을 키워요(가장자리는 배경인 경우가 많아서). 선명한 색일수록 조금 더 쳐줘요.
      const cx = Math.abs((x + 0.5) / width - 0.5) * 2, cy = Math.abs((y + 0.5) / height - 0.5) * 2;
      const central = 1 - Math.min(1, Math.max(cx, cy)) * 0.6;
      const w = central * (0.5 + s);
      const bin = Math.floor(h / (360 / BINS)) % BINS;
      const a = acc[bin];
      a.w += w; a.r += rgb[0] * w; a.g += rgb[1] * w; a.b += rgb[2] * w;
      total += w;
    }
  }
  if (total <= 0) return [];
  // 이웃한 색상 칸(±1)을 합쳐서 같은 계열이 둘로 쪼개지지 않게 해요.
  const scored = acc.map((a, i) => {
    const n1 = acc[(i + 1) % BINS], n0 = acc[(i + BINS - 1) % BINS];
    return { i, w: a.w + 0.5 * (n0.w + n1.w), a };
  }).filter((x) => x.a.w > 0).sort((p, q) => q.w - p.w);
  const out: Candidate[] = [];
  const usedBins: number[] = [];
  for (const c of scored) {
    if (out.length >= max) break;
    if (usedBins.some((u) => { const d = Math.abs(u - c.i); return Math.min(d, BINS - d) <= 1; })) continue; // 비슷한 색상은 한 번만
    if (c.a.w / total < 0.04) break; // 비중이 너무 작은 색은 후보에서 제외
    usedBins.push(c.i);
    out.push({ hex: tuneForSchedule(toHex([c.a.r / c.a.w, c.a.g / c.a.w, c.a.b / c.a.w])), share: c.a.w / total });
  }
  // 보정 후 거의 같은 색이 된 후보는 하나만 남겨요.
  const uniq: Candidate[] = [];
  for (const c of out) if (!uniq.some((u) => u.hex === c.hex)) uniq.push(c);
  return uniq;
}

/** 이미지 파일(또는 같은 출처 이미지 주소)에서 후보를 뽑아요. 못 읽으면 에러를 던져요(호출한 쪽에서 안내만 하고 계속 진행). */
export async function candidatesFromImage(src: Blob | string, max = 4): Promise<Candidate[]> {
  const bmp = await loadBitmap(src);
  const scale = Math.min(1, COLOR_MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("이 브라우저에서는 이미지를 분석할 수 없어요.");
  ctx.drawImage(bmp, 0, 0, w, h);
  return extractCandidates(ctx.getImageData(0, 0, w, h).data, w, h, max);
}

async function loadBitmap(src: Blob | string): Promise<{ width: number; height: number } & CanvasImageSource> {
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
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}
