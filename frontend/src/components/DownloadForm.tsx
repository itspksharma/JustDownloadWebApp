import React, { useState } from "react";
import { startDownload } from "../api";
import type { TaskStatus, StartRequest } from "../types";

export type Category = "audio" | "video" | "image";

export default function DownloadForm({ onStarted }: { onStarted: (t: TaskStatus) => void }) {
  const [url, setUrl] = useState("");
  const [category, setCategory] = useState<Category>("video");
  const [fmt, setFmt] = useState<string>("mp4");
  const [quality, setQuality] = useState<string>("720p");
  const [loading, setLoading] = useState(false);

  const fmtsByCategory: Record<Category, string[]> = {
    audio: ["mp3", "m4a", "aac"],
    video: ["mp4", "mkv", "webm"],
    image: ["jpeg", "png"],
  };

  function onCategoryChange(c: Category) {
    setCategory(c);
    setFmt(fmtsByCategory[c][0]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;
    setLoading(true);
    try {
      const payload: StartRequest = { url, category, fmt, quality };
      const task = await startDownload(payload);
      onStarted(task);
      setUrl("");
    } catch {
      alert("Failed to start download. Check URL/API.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-slate-900/70 backdrop-blur rounded-2xl p-5 shadow-lg border border-slate-700 flex flex-col gap-4 text-slate-200"
    >
    <div className="flex items-center gap-2 text-lg font-semibold text-white">
      <img src="./src/assets/thumbsup.png" alt="👍" className="w-6 h-6" />
      Download Here
    </div>


      <input
        required
        placeholder="Paste your favorite link here 🎬🎶"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="w-full border border-slate-700 rounded-xl p-3 bg-slate-800 text-slate-200 placeholder-slate-500 focus:ring-2 focus:ring-sky-500 focus:outline-none"
        type="url"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-slate-400">Category</label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as Category)}
            className="border border-slate-700 rounded-xl p-2 bg-slate-800 text-slate-200 focus:ring-2 focus:ring-sky-500"
          >
            <option value="audio">Audio</option>
            <option value="video">Video</option>
            <option value="image">Image</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-slate-400">Format</label>
          <select
            value={fmt}
            onChange={(e) => setFmt(e.target.value)}
            className="border border-slate-700 rounded-xl p-2 bg-slate-800 text-slate-200 focus:ring-2 focus:ring-sky-500"
          >
            {fmtsByCategory[category].map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm text-slate-400">Quality</label>
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="border border-slate-700 rounded-xl p-2 bg-slate-800 text-slate-200 focus:ring-2 focus:ring-sky-500 disabled:opacity-50"
            disabled={category === "image"}
          >
            <option value="best">Best</option>
            <option value="1080p">1080p</option>
            <option value="720p">720p</option>
            <option value="480p">480p</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          disabled={loading}
          type="submit"
          className="px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white shadow-md disabled:opacity-60 transition"
        >
          {loading ? "Starting..." : "Start Download"}
        </button>
      </div>
    </form>
  );
}
