import React, { useEffect, useRef, useState } from "react";
import ProgressBar from "./ProgressBar";
import type { TaskStatus } from "../types";
import ViewerModal from "./ViewerModal";
import { headFile } from "../api"; // ⬅️ NEW

type Props = {
  task: TaskStatus;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onCancel: (id: string) => void;
};

const DownloadItem: React.FC<Props> = ({ task, onPause, onResume, onCancel }) => {
  const humanSpeed = task.speed
    ? `${(task.speed / (1024 * 1024)).toFixed(1)} MB/s`
    : "—";
  const eta =
    task.eta != null ? `${Math.floor(task.eta / 60)}m ${task.eta % 60}s` : "—";

  const linkRef = useRef<HTMLAnchorElement | null>(null);
  const [autoDownloaded, setAutoDownloaded] = useState(false);
  const [downloadNowActive, setDownloadNowActive] = useState(true);

  // VIEW MODAL state
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);

  // auto-download after completion (as you had)
  useEffect(() => {
    if (task.status === "completed" && task.download_url && !autoDownloaded) {
      const t = setTimeout(() => {
        try {
          linkRef.current?.click();
        } catch (e) {
          console.error("Auto-download failed", e);
        }
        setAutoDownloaded(true);
      }, 100);
      return () => clearTimeout(t);
    }
    if (task.status !== "completed") {
      setAutoDownloaded(false);
    }
  }, [task.status, task.download_url, autoDownloaded]);

  // "Download Now" button active for 30s only
  useEffect(() => {
    if (task.status === "completed") {
      setDownloadNowActive(true);
      const timer = setTimeout(() => setDownloadNowActive(false), 30000);
      return () => clearTimeout(timer);
    }
  }, [task.status]);

  async function openViewer() {
    if (!task.download_url) return;
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerError(null);
    setViewerType(null);

    // HEAD to check availability & get content-type (file might be auto-deleted by backend)
    const info = await headFile(task.download_url);

    if (!info.ok) {
      setViewerLoading(false);
      setViewerError(
        info.status === 404
          ? "File seems to be deleted by server cleanup. Please re-download."
          : "Unable to access file for preview. Try downloading instead."
      );
      return;
    }

    setViewerType(info.contentType);
    setViewerLoading(false);
  }

  return (
    <div className="p-4 bg-slate-900/70 backdrop-blur rounded-2xl shadow-lg border border-slate-700 flex flex-col gap-3 text-slate-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs text-slate-400 truncate max-w-[240px] sm:max-w-[400px]">
            {task.url}
          </div>
          <div
            className={`font-medium truncate max-w-[240px] sm:max-w-[400px] ${
              task.status === "canceled"
                ? "line-through text-slate-500"
                : "text-white"
            }`}
          >
            {task.title || task.filename || "Untitled"}
          </div>
        </div>

        <span
          className={`px-2 py-0.5 text-[10px] sm:text-xs rounded-full border font-medium capitalize self-start sm:self-auto ${
            task.status === "completed"
              ? "bg-emerald-600/20 text-emerald-300 border-emerald-500"
              : task.status === "downloading"
              ? "bg-sky-600/20 text-sky-300 border-sky-500"
              : task.status === "paused"
              ? "bg-amber-600/20 text-amber-300 border-amber-500"
              : task.status === "error"
              ? "bg-rose-600/20 text-rose-300 border-rose-500"
              : task.status === "canceled"
              ? "bg-slate-600/30 text-slate-400 border-slate-500"
              : "bg-slate-700/40 text-slate-300 border-slate-500"
          }`}
        >
          {task.status}
        </span>
      </div>

      {/* Progress */}
      <ProgressBar value={task.progress || 0} />

      {/* Details */}
      <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-between text-[11px] sm:text-xs text-slate-400 gap-y-1">
        <div>⚡ {humanSpeed}</div>
        <div>⏳ {eta}</div>
        <div>🎞 {task.fmt || "auto"}</div>
        <div>📺 {task.quality || "auto"}</div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 justify-end">
        {task.status === "downloading" && (
          <button
            onClick={() => onPause(task.id)}
            className="px-3 py-1 text-xs sm:text-sm rounded-xl bg-amber-500 hover:bg-amber-600 text-white shadow"
          >
            Pause
          </button>
        )}

        {task.status === "paused" && (
          <button
            onClick={() => onResume(task.id)}
            className="px-3 py-1 text-xs sm:text-sm rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow"
          >
            Resume
          </button>
        )}

        {task.status !== "completed" && task.status !== "canceled" && (
          <button
            onClick={() => onCancel(task.id)}
            className="px-3 py-1 text-xs sm:text-sm rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow"
          >
            Cancel
          </button>
        )}

        {/* hidden anchor for auto-download */}
        {task.download_url && (
          <a ref={linkRef} href={task.download_url} download className="hidden" />
        )}

        {/* Download Now (active 30s only) */}
        {task.status === "completed" &&
          task.download_url &&
          downloadNowActive && (
            <a
              href={task.download_url}
              download
              className="px-3 py-1 text-xs sm:text-sm rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow"
              onClick={() => setDownloadNowActive(false)}
            >
              Download Now
            </a>
          )}

        {/* View button (always show for completed with url) */}
        {task.status === "completed" && task.download_url && (
          <button
            onClick={openViewer}
            className="px-3 py-1 text-xs sm:text-sm rounded-xl bg-violet-600 hover:bg-violet-700 text-white shadow
                       hover:shadow-[0_0_15px_rgba(167,139,250,0.6)] transition-shadow"
            title="Preview in popup"
          >
            👁️ View
          </button>
        )}

        {/* Downloaded indicator */}
        {task.status === "completed" &&
          (!downloadNowActive || autoDownloaded) && (
            <button
              className="px-3 py-1 text-xs sm:text-sm rounded-xl bg-slate-700 text-slate-400 cursor-not-allowed"
              disabled
            >
              Downloaded
            </button>
          )}
      </div>

      {/* Message */}
      {task.message && (
        <div className="text-[11px] sm:text-xs text-slate-400 italic">
          💡 {task.message}
        </div>
      )}

      {/* Viewer Modal */}
      <ViewerModal
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        src={task.download_url || null}
        filename={task.filename || task.title || undefined}
        contentType={viewerType}
        loading={viewerLoading}
        error={viewerError}
      />
    </div>
  );
};

export default DownloadItem;
