export interface TaskStatus {
  id: string;
  url: string;
  title?: string;
  filename?: string;
  status: string;
  progress?: number;
  fmt?: string;
  quality?: string;
  filepath?: string;
  message?: string;
  speed?: number;  // bytes/sec
  eta?: number;    // seconds
  downloaded_at?: string;
  download_url?: string;
}

export interface StartRequest {
  url: string;
  category: "audio" | "video" | "image";
  fmt: string;
  quality: string;
}
