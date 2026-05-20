import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

interface Props {
  src: string; // رابط HLS (.m3u8)
  watermarkName: string;
  watermarkPhone: string;
  poster?: string;
}

/**
 * مشغل HLS مع علامة مائية شفافة متحركة عشوائياً كل 5 ثوانٍ،
 * تعطيل القائمة السياقية، blur عند فقدان التركيز،
 * ومنع التحميل.
 */
export function VideoPlayer({ src, watermarkName, watermarkPhone, poster }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState({ top: "10%", start: "10%" });
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (Hls.isSupported() && !v.canPlayType("application/vnd.apple.mpegurl")) {
      const hls = new Hls({ enableWorker: true });
      hls.loadSource(src);
      hls.attachMedia(v);
      return () => hls.destroy();
    } else {
      v.src = src;
    }
  }, [src]);

  // العلامة المائية تتحرك عشوائياً كل 5 ثوانٍ
  useEffect(() => {
    const t = setInterval(() => {
      setPos({
        top: `${Math.floor(Math.random() * 80) + 5}%`,
        start: `${Math.floor(Math.random() * 70) + 5}%`,
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // إخفاء الفيديو عند فقدان التركيز (مثل ALT+TAB) كمحاولة لردع تسجيل الشاشة
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState !== "visible");
    const onBlur = () => setHidden(true);
    const onFocus = () => setHidden(false);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  return (
    <div
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-glow no-select"
      onContextMenu={(e) => e.preventDefault()}
    >
      <video
        ref={videoRef}
        poster={poster}
        controls
        controlsList="nodownload noremoteplayback noplaybackrate"
        disablePictureInPicture
        playsInline
        className="w-full h-full object-contain"
      />
      {hidden && (
        <div className="absolute inset-0 bg-black flex items-center justify-center text-white text-lg font-display">
          ⏸ الفيديو متوقف — أعد فتح النافذة للاستمرار
        </div>
      )}
      {/* العلامة المائية */}
      <div
        className="pointer-events-none absolute text-white/15 text-sm font-medium select-none transition-all duration-700"
        style={{ top: pos.top, insetInlineStart: pos.start }}
      >
        <div className="bg-black/30 px-3 py-1 rounded-md backdrop-blur-[1px]">
          {watermarkName} · {watermarkPhone}
        </div>
      </div>
    </div>
  );
}