"use client";

import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { firstFrameCanvas, isGifUrl } from "@/lib/posterFile";

const cache = new Map<string, string>(); // GIF 주소 → 첫 프레임(PNG data URL)

/**
 * 포스터 이미지를 '움직이지 않게' 보여줘요. 새로 올리는 GIF는 올릴 때 이미 PNG로 바뀌어 저장되므로 보통은 그냥 <img>예요.
 * 예전에 올라가 있던 .gif 주소는 여기서 첫 프레임만 그려 보여주고, 그릴 수 없으면 onError를 불러서 기본 포스터로 대신해요(움직이는 그림은 보여주지 않아요).
 */
export default function StaticImg({ src, onError, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { src: string; alt: string }) {
  const gif = isGifUrl(src);
  const [frozen, setFrozen] = useState<string>(() => (gif ? cache.get(src) ?? "" : ""));
  useEffect(() => {
    if (!gif) { setFrozen(""); return; }
    const hit = cache.get(src);
    if (hit) { setFrozen(hit); return; }
    let off = false;
    setFrozen("");
    firstFrameCanvas(src).then((cv) => {
      const u = cv.toDataURL("image/png");
      cache.set(src, u);
      if (!off) setFrozen(u);
    }).catch(() => { if (!off) onError?.({} as never); });
    return () => { off = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, gif]);
  if (gif && !frozen) return null; // 정지 프레임이 준비되기 전에는 아무것도 그리지 않아요(움직이는 원본을 먼저 보여주지 않기 위해)
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...rest} src={gif ? frozen : src} onError={onError} />;
}
