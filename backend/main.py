# File: main.py
from __future__ import annotations
import threading, os, uuid, requests, subprocess, sys, shutil, glob, time, re
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from fastapi.staticfiles import StaticFiles
from datetime import datetime
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response


# Ensure downloads folder exists
DOWNLOAD_DIR = os.path.join(os.getcwd(), "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)


# ✅ Where frontend build lives (mounted via docker-compose)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.getenv("FRONTEND_DIST", os.path.abspath(os.path.join(BASE_DIR, "..", "frontend", "dist")))

# ---- Models ----
class TaskStatus(BaseModel):
    id: str
    url: str
    title: Optional[str] = None        # fetched page/video title (stable)
    filename: Optional[str] = None     # actual saved file name on disk
    status: str
    progress: Optional[float] = 0.0
    fmt: Optional[str] = None
    quality: Optional[str] = None
    filepath: Optional[str] = None
    message: Optional[str] = None
    speed: Optional[float] = None
    eta: Optional[int] = None
    downloaded_at: Optional[str] = None  # date-time when completed
    download_url: Optional[str] = None   # public URL for frontend to download


class StartRequest(BaseModel):
    url: str
    category: str
    fmt: str
    quality: str


# ---- Task & Manager ----
class Task:
    def __init__(self, tid: str, req: StartRequest):
        self.id = tid
        self.url = req.url
        self.category = req.category
        self.fmt = req.fmt
        self.quality = req.quality
        self.status = "pending"
        self.progress = 0.0
        self.title: Optional[str] = None
        self.filename: Optional[str] = None
        self.filepath: Optional[str] = None
        self.message: Optional[str] = None
        self.control = ""             # "pause" | "cancel" | ""
        self.speed: Optional[float] = None
        self.eta: Optional[int] = None
        self.downloaded_at: Optional[str] = None
        self.download_url: Optional[str] = None
        self.lock = threading.Lock()
        self.thread: Optional[threading.Thread] = None

    def to_status(self) -> TaskStatus:
        return TaskStatus(
            id=self.id,
            url=self.url,
            title=self.title,
            filename=self.filename,
            status=self.status,
            progress=self.progress,
            fmt=self.fmt,
            quality=self.quality,
            filepath=self.filepath,
            message=self.message,
            speed=self.speed,
            eta=self.eta,
            downloaded_at=self.downloaded_at,
            download_url=self.download_url,
        )


class Manager:
    def __init__(self):
        self.tasks: dict[str, Task] = {}

    def get(self, tid: str) -> Task:
        if tid not in self.tasks:
            raise KeyError
        return self.tasks[tid]

    def all(self) -> List[TaskStatus]:
        return [t.to_status() for t in self.tasks.values()]
    
        # ✅ New method: clear complete task (memory free)
    def clear_completed(self):
        to_delete = [tid for tid, t in self.tasks.items() if t.status == "completed"]
        for tid in to_delete:
            del self.tasks[tid]

    def clear_canceled(self):
        to_delete = [tid for tid, t in self.tasks.items() if t.status == "canceled"]
        for tid in to_delete:
            del self.tasks[tid]


manager = Manager()
app = FastAPI()



# ✅ CORS (dev friendly)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ✅ Do NOT cache API responses
@app.middleware("http")
async def no_cache_for_api(request, call_next):
    response: Response = await call_next(request)
    if request.url.path.startswith("/api/"):
        # ensure API is always fresh
        response.headers["Cache-Control"] = "no-store"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

# ---- Helpers ----
def get_video_title(url: str) -> Optional[str]:
    cmd = _ytdlp_cmd()
    if not cmd:
        return None
    try:
        result = subprocess.run(cmd + ["--get-title", url], capture_output=True, text=True, timeout=20)
        if result.returncode == 0:
            title = result.stdout.strip()
            return title if title else None
    except Exception:
        pass
    return None

def _bin_exists(name: str) -> bool:
    return shutil.which(name) is not None

def _ytdlp_cmd() -> list[str] | None:
    ytdlp_bin = shutil.which("yt-dlp") or shutil.which("yt_dlp")
    if ytdlp_bin:
        return [ytdlp_bin]
    # fallback to python -m yt_dlp if installed
    try:
        import yt_dlp  # noqa
        return [sys.executable, "-m", "yt_dlp"]
    except Exception:
        return None

def _ytdlp_version() -> str | None:
    cmd = _ytdlp_cmd()
    if not cmd: 
        return None
    try:
        out = subprocess.check_output(cmd + ["--version"], text=True, timeout=10)
        return out.strip() or None
    except Exception:
        return None

def _ffmpeg_version() -> str | None:
    if not _bin_exists("ffmpeg"):
        return None
    try:
        out = subprocess.check_output(["ffmpeg", "-version"], text=True, timeout=10)
        return out.splitlines()[0]
    except Exception:
        return None

@app.get("/api/health")
def health():
    return {
        "yt_dlp": _ytdlp_version(),
        "ffmpeg": _ffmpeg_version(),
        "time": datetime.now().isoformat(),
    }



# ---- Download Workers ----
def run_ytdlp(task: Task):
    ytdlp_bin = shutil.which("yt-dlp") or shutil.which("yt_dlp")
    base = [ytdlp_bin] if ytdlp_bin else [sys.executable, "-m", "yt_dlp"]

    safe_title = re.sub(r'[\\/*?:"<>|]', "_", task.title) if task.title else task.id
    outtmpl = os.path.join(DOWNLOAD_DIR, f"{safe_title}.%(ext)s")

    fsel_video = "bv*+ba/best"
    fsel_audio = "bestaudio/best"

    # Build command incrementally so frontend fmt/quality actually reflect
    cmd: list[str] = base + ["--newline", "-o", outtmpl]

    # quality (video only) using sort key
    if task.category in ("video",) and isinstance(task.quality, str) and task.quality.endswith("p"):
        try:
            res = int(task.quality[:-1])
            cmd += ["-S", f"res:{res}"]
        except Exception:
            pass

    # format selection (and extraction for audio)
    if task.category == "audio":
        cmd += ["-f", fsel_audio, "-x"]
        afmt = (task.fmt or "").lower()
        if afmt in {"mp3", "m4a", "aac"}:
            cmd += ["--audio-format", afmt]
        # why: reflect user's chosen audio format from UI
    else:  # video
        cmd += ["-f", fsel_video]
        vfmt = (task.fmt or "").lower()
        if vfmt in {"mp4", "mkv", "webm"}:
            cmd += ["--merge-output-format", vfmt]
        # why: container preference without heavy re-encode

    cmd += [task.url]

    try:
        with task.lock:
            task.status = "downloading"
            task.progress = 0.0

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="ignore",
        )

        assert process.stdout is not None
        speed_re = re.compile(r"([0-9.]+)\s*(KiB|MiB|GiB)/s")
        eta_re = re.compile(r"ETA\s*(\d+):(\d+)")

        for raw_line in process.stdout:
            line = raw_line.strip()

            # parse progress lines
            if line.startswith("[download]") and "%" in line:
                try:
                    pct_part = line.split("%", 1)[0].split()[-1]
                    pct = float(pct_part)
                    with task.lock:
                        task.progress = max(0.0, min(1.0, pct / 100.0))

                    m = speed_re.search(line)
                    if m:
                        val, unit = m.groups()
                        mult = 1024 if unit == "KiB" else (1024 ** 2 if unit == "MiB" else 1024 ** 3)
                        with task.lock:
                            task.speed = float(val) * mult

                    m2 = eta_re.search(line)
                    if m2:
                        mm, ss = map(int, m2.groups())
                        with task.lock:
                            task.eta = mm * 60 + ss
                except Exception:
                    pass

            # destination/merge lines -> set filename (DO NOT overwrite `title`)
            if "Destination:" in line:
                fname = line.split("Destination:", 1)[1].strip().strip('"')
                with task.lock:
                    task.filename = os.path.basename(fname)
                    task.download_url = f"/downloads/{task.filename}"

            if 'Merging formats into "' in line:
                fname = line.split('Merging formats into "', 1)[1].rstrip('"')
                with task.lock:
                    task.filename = os.path.basename(fname)
                    task.download_url = f"/downloads/{task.filename}"

            # control checks
            with task.lock:
                if task.control == "pause":
                    try:
                        process.terminate()
                    except Exception:
                        pass
                    task.status = "paused"
                    return
                if task.control == "cancel":
                    try:
                        process.terminate()
                    except Exception:
                        pass
                    task.status = "canceled"
                    return

        process.wait()

        # if filename not captured earlier, try to find a file matching the task id
        if not task.filename:
            matches = sorted(glob.glob(os.path.join(DOWNLOAD_DIR, f"{task.id}.*")))
            if matches:
                fname = os.path.basename(matches[0])
                with task.lock:
                    task.filename = fname
                    task.download_url = f"/downloads/{fname}"

        with task.lock:
            if task.status not in ("paused", "canceled"):
                task.progress = 1.0
                task.status = "completed"
                task.downloaded_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if task.filename:
                    task.download_url = f"/downloads/{task.filename}"

                if task.status not in ("paused", "canceled"):
                    if task.filename:  # only complete if we got a real file
                        task.progress = 1.0
                        task.status = "completed"
                        task.downloaded_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        task.download_url = f"/downloads/{task.filename}"
                    else:
                        task.status = "error"
                        task.message = "Download finished but file not found"

    except Exception as e:
        with task.lock:
            task.status = "error"
            task.message = str(e)


def run_image(task: Task):
    try:
        with task.lock:
            task.status = "downloading"
            task.progress = 0.0

        r = requests.get(task.url, stream=True, timeout=60)
        r.raise_for_status()
        ext = (task.fmt or "jpg").lstrip(".")
        fname = f"{task.id}.{ext}"
        fpath = os.path.join(DOWNLOAD_DIR, fname)

        total = int(r.headers.get("content-length", 0) or 0)
        downloaded = 0
        start = time.time()

        with open(fpath, "wb") as f:
            for chunk in r.iter_content(1024 * 64):
                if not chunk:
                    continue

                with task.lock:
                    if task.control == "pause":
                        task.status = "paused"
                        return
                    if task.control == "cancel":
                        task.status = "canceled"
                        return

                f.write(chunk)
                downloaded += len(chunk)

                if total:
                    with task.lock:
                        task.progress = max(0.0, min(1.0, downloaded / total))
                        elapsed = max(1, time.time() - start)
                        task.speed = downloaded / elapsed
                        remaining = total - downloaded
                        task.eta = int(remaining / task.speed) if task.speed else None

        with task.lock:
            task.status = "completed"
            task.progress = 1.0
            task.filename = fname
            task.download_url = f"/downloads/{fname}"
            task.downloaded_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            task.download_url = f"/downloads/{fname}"

    except Exception as e:
        with task.lock:
            task.status = "error"
            task.message = str(e)


# ---- Auto cleanup worker ----
def cleanup_worker():
    while True:
        now = time.time()
        for tid, task in list(manager.tasks.items()):
            with task.lock:
                if task.status in ("completed", "canceled") and task.filename:
                    fpath = os.path.join(DOWNLOAD_DIR, task.filename)
                    # agar file 10 min purani hai to delete
                    if os.path.exists(fpath):
                        mtime = os.path.getmtime(fpath)
                        if now - mtime > 600:  # 600 sec = 10 min
                            try:
                                os.remove(fpath)
                                print(f"🧹 Deleted old file: {fpath}")
                            except Exception as e:
                                print("Cleanup error:", e)



# Start cleanup worker
threading.Thread(target=cleanup_worker, daemon=True).start()



# ---- Endpoints ----

MAX_TASKS = 20

@app.post("/api/download/start", response_model=TaskStatus)
def start_download(req: StartRequest):
    if len([t for t in manager.tasks.values() if t.status in ("pending","downloading")]) >= MAX_TASKS:
        raise HTTPException(429, "⚠️ Too many active downloads (max 20). Please wait or clear old tasks.")

    tid = str(uuid.uuid4())
    task = Task(tid, req)
    manager.tasks[tid] = task

    # fetch title separately and store in task.title (do not use as filename)
    title = get_video_title(req.url)
    if title:
        with task.lock:
            task.title = title

    def runner():
        if task.category in ["video", "audio"]:
            run_ytdlp(task)
        elif task.category == "image":
            run_image(task)
        else:
            with task.lock:
                task.status = "error"
                task.message = "Unsupported category"

    t = threading.Thread(target=runner, daemon=True)
    task.thread = t
    t.start()
    return task.to_status()


@app.get("/api/download/all", response_model=List[TaskStatus])
def all_status():
    return manager.all()


@app.get("/api/download/{tid}/status", response_model=TaskStatus)
def get_status(tid: str):
    try:
        return manager.get(tid).to_status()
    except KeyError:
        raise HTTPException(404, "Task not found")


@app.post("/api/download/{tid}/pause", response_model=TaskStatus)
def pause_task(tid: str):
    try:
        task = manager.get(tid)
    except KeyError:
        raise HTTPException(404, "Task not found")
    with task.lock:
        task.control = "pause"
        task.status = "paused"
    return task.to_status()


@app.post("/api/download/{tid}/cancel", response_model=TaskStatus)
def cancel_task(tid: str):
    try:
        task = manager.get(tid)
    except KeyError:
        raise HTTPException(404, "Task not found")
    with task.lock:
        task.control = "cancel"
        task.status = "canceled"
    return task.to_status()


@app.post("/api/download/{tid}/resume", response_model=TaskStatus)
def resume_task(tid: str):
    try:
        task = manager.get(tid)
    except KeyError:
        raise HTTPException(404, "Task not found")

    with task.lock:
        task.control = ""  # reset control flag before resuming
        task.status = "downloading"

    def runner():
        if task.category in ["video", "audio"]:
            run_ytdlp(task)
        elif task.category == "image":
            run_image(task)

    t = threading.Thread(target=runner, daemon=True)
    task.thread = t
    t.start()
    return task.to_status()

@app.post("/api/download/clear-completed")
def clear_completed_tasks():
    manager.clear_completed()
    return {"message": "Completed tasks cleared"}

@app.post("/api/clear-canceled")
def clear_canceled():
    manager.clear_canceled()
    return {"status": "ok"}






BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/downloads", StaticFiles(directory=DOWNLOAD_DIR), name="downloads")

def _no_cache_file_response(path: str) -> FileResponse:
    resp = FileResponse(path)
    # index.html should never be cached
    resp.headers["Cache-Control"] = "no-cache"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="assets")
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")

    @app.get("/", include_in_schema=False)
    async def _root():
        return _no_cache_file_response(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/index.html", include_in_schema=False)
    async def _index_html():
        return _no_cache_file_response(os.path.join(FRONTEND_DIST, "index.html"))
    
    @app.get("/sw.js", include_in_schema=False)
    async def _sw():
        return _no_cache_file_response(os.path.join(FRONTEND_DIST, "sw.js"))

    @app.get("/service-worker.js", include_in_schema=False)
    async def _service_worker():
        return _no_cache_file_response(os.path.join(FRONTEND_DIST, "service-worker.js"))

    @app.get("/manifest.webmanifest", include_in_schema=False)
    async def _manifest():
        return _no_cache_file_response(os.path.join(FRONTEND_DIST, "manifest.webmanifest"))

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        # For any SPA path return fresh index.html
        return _no_cache_file_response(os.path.join(FRONTEND_DIST, "index.html"))



if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
