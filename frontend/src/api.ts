import axios from "axios";
import type { StartRequest, TaskStatus } from "./types";

const api = axios.create({ baseURL: "/api" });

export const startDownload = async (payload: StartRequest) =>
  (await api.post<TaskStatus>("/download/start", payload)).data;

export const getStatus = async (id: string) =>
  (await api.get<TaskStatus>(`/download/${id}/status`)).data;

export const getAll = async () =>
  (await api.get<TaskStatus[]>("/download/all")).data;

export const pause = async (id: string) =>
  (await api.post<TaskStatus>(`/download/${id}/pause`)).data;

export const resume = async (id: string) =>
  (await api.post<TaskStatus>(`/download/${id}/resume`)).data;

export const cancel = async (id: string) =>
  (await api.post<TaskStatus>(`/download/${id}/cancel`)).data;

// api.ts
export const clearCompletedApi = async () =>
  (await api.post("/download/clear-completed")).data;

export const clearCanceledApi = async () =>
  (await api.post("/clear-canceled")).data;


// ...existing imports & functions...

export async function headFile(url: string): Promise<{
  ok: boolean;
  contentType: string | null;
  contentLength: number | null;
  status: number;
}> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return {
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get("content-type"),
      contentLength: res.headers.get("content-length")
        ? Number(res.headers.get("content-length"))
        : null,
    };
  } catch {
    return { ok: false, status: 0, contentType: null, contentLength: null };
  }
}
