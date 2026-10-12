import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

/** Ambil data dari API, dengan polling opsional (berhenti saat tab tidak terlihat). */
export function useApi<T>(path: string | null, intervalMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(async () => {
    const current = pathRef.current;
    if (!current) return;
    try {
      const result = await api<T>(current);
      if (pathRef.current === current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (pathRef.current === current) setError(err as ApiError);
    } finally {
      if (pathRef.current === current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(path !== null);
    if (!path) return;
    load();
    if (!intervalMs) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [path, intervalMs, load]);

  return { data, error, loading, reload: load, setData };
}

export function useTitle(title: string, noindex = false) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-app]');
    if (noindex) {
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "robots";
        meta.setAttribute("data-app", "1");
        document.head.appendChild(meta);
      }
      meta.content = "noindex, nofollow";
    }
    return () => meta?.remove();
  }, [title, noindex]);
}

export function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return Math.random().toString(36).slice(2, 14);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
