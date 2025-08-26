import React, { useEffect, useState } from "react";
import DownloadForm from "./components/DownloadForm";
import DownloadItem from "./components/DownloadItem";
import { getAll, pause, resume, cancel, clearCompletedApi,clearCanceledApi } from "./api";
import type { TaskStatus } from "./types";
import { motion, AnimatePresence } from "framer-motion";
import Lottie from "react-lottie-player";
import walkingEmoji from "./assets/RobotSaysHi.json";

function Footer() {
  return (
    <div className="relative">
      {/* Walking Animation Above Footer */}
      <motion.div
        className="absolute -top-12 w-16 h-16 z-20"
        animate={{
          x: ["-100%", "calc(50% - 2rem)", "-100%"], // left -> mid -> left
        }}
        transition={{
          duration: 10, // ek round trip ka time
          repeat: Infinity,
          ease: "linear",
        }}
      >
        <Lottie
          loop
          play
          animationData={walkingEmoji}
          style={{ width: "100%", height: "100%" }}
        />
      </motion.div>


      {/* Footer */}
      <footer className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t border-slate-700 text-slate-300 px-4 py-6 text-center">
        {/* Subtle animated gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.05),_transparent_50%)] animate-pulse" />

        {/* Footer Text */}
        <div className="relative z-10 space-y-2">
          <p>
            Developed by{" "}
            <span className="font-semibold text-white">Pawan Kumar Sharma</span>
          </p>
          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <a
              href="https://www.askdevpk.me/"
              target="_blank"
              className="text-violet-300 hover:underline"
            >
              About Me
            </a>
            <a
              href="https://www.linkedin.com/in/itspksharma98/"
              target="_blank"
              className="text-violet-300 hover:underline"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com/itspksharma"
              target="_blank"
              className="text-violet-300 hover:underline"
            >
              GitHub
            </a>
          </div>
          <p className="text-xs">
            💡 Tip: To install this app,{" "}
            <a
              href="https://justdownload.askdevpk.me/"
              target="_blank"
              className="underline text-violet-300"
            >
              visit the main website
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [shooting, setShooting] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  async function refreshAll() {
    try {
      const data = await getAll();
      setTasks(
        data.sort((a, b) => {
          if (a.status === "downloading" && b.status !== "downloading") return -1;
          if (b.status === "downloading" && a.status !== "downloading") return 1;
          return 0;
        })
      );
    } catch {}
  }

  useEffect(() => {
    const iv = setInterval(refreshAll, 1000);
    return () => clearInterval(iv);
  }, []);

  const clearCompleted = async () => {
    try {
      await clearCompletedApi();
      refreshAll();
    } catch {
      setTasks((prev) => prev.filter((t) => t.status !== "completed"));
    }
  };

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");
  const canceledTasks = tasks.filter((t) => t.status === "canceled");


// performance popup if too many download 
useEffect(() => {
  if (completedTasks.length > 10) {
    alert("⚡ Too many completed downloads. Clear them for better performance!");
  }
}, [completedTasks]);



  // Shooting star every 20s
  useEffect(() => {
    const iv = setInterval(() => {
      setShooting(true);
      setTimeout(() => setShooting(false), 2000);
    }, 20000);
    return () => clearInterval(iv);
  }, []);

  // Hide Welcome after 3s
  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden text-white flex flex-col">
      {/* Background full screen + animation */}
      <div className="absolute inset-0 -z-10 area">
        <ul className="circles">
          {Array.from({ length: 10 }).map((_, i) => (
            <li key={i}></li>
          ))}
        </ul>
      </div>

      {/* Shooting star */}
      {shooting && (
        <motion.div
          className="absolute top-20 left-[-100px] w-1 h-1 bg-white rounded-full shadow-[0_0_20px_5px_rgba(255,255,255,0.8)] z-50"
          animate={{ x: ["0%", "120vw"], y: ["0%", "40vh"] }}
          transition={{ duration: 2, ease: "easeInOut" }}
        />
      )}

      {/* Main Content */}
      <div className="relative flex-1 w-full mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-6 space-y-6 z-10 max-w-full md:max-w-3xl lg:max-w-5xl">
        {/* Header */}
        <header className="flex flex-col items-center text-center gap-2">
          <AnimatePresence>
            {showWelcome && (
              <motion.h1
                key="welcome"
                initial={{ opacity: 0, y: -50, scale: 0.8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.8 }}
                transition={{ duration: 1 }}
                className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.8)]"
              >
                WELCOME
              </motion.h1>
            )}
          </AnimatePresence>
          {!showWelcome && (
            <motion.h1
              key="main-title"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1 }}
              className={`text-3xl sm:text-4xl md:text-5xl font-extrabold transition duration-500 ${
                shooting
                  ? "text-yellow-300 drop-shadow-[0_0_15px_#fde047]"
                  : "text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]"
              }`}
            >
              JUST-DOWNLOAD
            </motion.h1>
          )}
          <p className="text-slate-200 text-sm sm:text-base md:text-lg">
            Fast, Simple & Reliable Downloads
          </p>

          {/* 🔗 Download App Link */}
          <a
            href="https://justdownload.askdevpk.me/download/"
            target="_blank"
            className="mt-2 text-xs px-4 py-1.5 rounded-lg bg-green-300 text-slate-900 font-medium hover:bg-green-400 transition"
          >
            📥 Download This App
          </a>
        </header>

        {/* Download Form */}
        <DownloadForm onStarted={(t) => setTasks((prev) => [t, ...prev])} />

        {/* Active Downloads */}
        <section className="bg-slate-900/60 rounded-2xl p-4 sm:p-6 shadow space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm sm:text-base md:text-lg font-semibold text-slate-200">
              Active Downloads
            </div>
          </div>
          <div className="grid gap-3 sm:gap-4">
            {activeTasks.length === 0 && (
              <div className="text-slate-400 text-xs sm:text-sm text-center">
                No active downloads.
              </div>
            )}
            {activeTasks.map((task) => (
              <DownloadItem
                key={task.id}
                task={task}
                onPause={(id) => pause(id)}
                onResume={(id) => resume(id)}
                onCancel={(id) => cancel(id)}
              />
            ))}
          </div>
        </section>

        {/* Completed Downloads */}
        <section className="bg-slate-900/60 rounded-2xl p-4 sm:p-6 shadow space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm sm:text-base md:text-lg font-semibold text-slate-200">
              Completed Downloads
            </div>
            <button
              onClick={clearCompleted}
              className="text-xs px-3 py-1 rounded-lg bg-rose-100 text-rose-600 hover:bg-rose-200"
            >
              Clear Completed
            </button>
          </div>
          <div className="grid gap-3 sm:gap-4">
            {completedTasks.length === 0 && (
              <div className="text-slate-400 text-xs sm:text-sm text-center">
                No completed downloads yet.
              </div>
            )}
            {completedTasks.map((task) => (
              <DownloadItem
                key={task.id}
                task={task}
                onPause={(id) => pause(id)}
                onResume={(id) => resume(id)}
                onCancel={(id) => cancel(id)}
              />
            ))}
          </div>
        </section>
        


              {/* Canceled Downloads */}
        <section className="bg-slate-900/60 rounded-2xl p-4 sm:p-6 shadow space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm sm:text-base md:text-lg font-semibold text-slate-200">
              Canceled Downloads
            </div>
            <button
              onClick={async () => {
                try {
                  await clearCanceledApi();
                  refreshAll();
                } catch {
                  setTasks((prev) => prev.filter((t) => t.status !== "canceled"));
                }
              }}
              className="text-xs px-3 py-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              Clear Canceled
            </button>
          </div>
          <div className="grid gap-3 sm:gap-4">
            {canceledTasks.length === 0 && (
              <div className="text-slate-400 text-xs sm:text-sm text-center">
                No canceled downloads yet.
              </div>
            )}
            {canceledTasks.map((task) => (
              <DownloadItem
                key={task.id}
                task={task}
                onPause={(id) => pause(id)}
                onResume={(id) => resume(id)}
                onCancel={(id) => cancel(id)}
              />
            ))}
          </div>
        </section>
      </div>

      {/* Footer */}
      <Footer />
    </div>
  );
}
