import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  onClose: () => void;
  src: string | null;
  filename?: string | null;
  contentType?: string | null;
  loading?: boolean;
  error?: string | null;
};

function isImage(ct?: string | null, src?: string | null) {
  if (ct?.startsWith("image/")) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?.*)?$/i.test(src || "");
}

function isVideo(ct?: string | null, src?: string | null) {
  if (ct?.startsWith("video/")) return true;
  return /\.(mp4|webm|mkv|mov|avi)(\?.*)?$/i.test(src || "");
}

function isAudio(ct?: string | null, src?: string | null) {
  if (ct?.startsWith("audio/")) return true;
  return /\.(mp3|m4a|aac|wav|ogg|flac)(\?.*)?$/i.test(src || "");
}

export default function ViewerModal({
  open,
  onClose,
  src,
  filename,
  contentType,
  loading,
  error,
}: Props) {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            if (e.target === overlayRef.current) onClose();
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Popup box with border + sliding animation */}
            <motion.div
            className="relative w-full max-w-4xl bg-slate-900/95 border-4 border-emerald-500 rounded-2xl shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.8, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 50 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            >

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
              <div className="text-sm text-slate-300 truncate pr-2">
                {filename || src}
              </div>
              <button
                onClick={onClose}
                className="px-3 py-1 text-xs rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
              >
                ✕ Close
              </button>
            </div>

            {/* Body */}
            <div className="p-4">
              {loading && (
                <div className="text-center text-slate-300 text-sm py-12">
                  Checking file availability…
                </div>
              )}

              {!loading && error && (
                <div className="text-center text-rose-300 text-sm py-12">
                  {error}
                </div>
              )}

              {!loading && !error && src && (
                <div className="w-full">
                  {isImage(contentType, src) && (
                    <img
                      src={src}
                      alt={filename || "preview"}
                      className="max-h-[70vh] w-full object-contain rounded-xl"
                      loading="eager"
                    />
                  )}

                  {isVideo(contentType, src) && (
                    <video
                      key={src} // 🔑 ensures reload each open/close
                      src={src}
                      controls
                      autoPlay
                      className="w-full max-h-[70vh] rounded-xl bg-black"
                      preload="metadata"
                    />
                  )}

                  {isAudio(contentType, src) && (
                    <audio
                      key={src}
                      src={src}
                      controls
                      className="w-full"
                      preload="metadata"
                    />
                  )}

                  {!isImage(contentType, src) &&
                    !isVideo(contentType, src) &&
                    !isAudio(contentType, src) && (
                      <div className="text-center text-slate-300 text-sm py-10">
                        Preview not supported for this file type.
                        <div className="mt-3">
                          <a
                            href={src}
                            download
                            className="px-3 py-1 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                          >
                            Download file
                          </a>
                        </div>
                      </div>
                    )}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
