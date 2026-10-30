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

export function useTitle(title: string, noindex = false, description?: string) {
  useEffect(() => {
    document.title = title;

    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"][data-app]');
    if (noindex) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        robots.setAttribute("data-app", "1");
        document.head.appendChild(robots);
      }
      robots.content = "noindex, follow";
    }

    let descriptionMeta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    let createdDescription = false;
    const previousDescription = descriptionMeta?.content;
    if (description) {
      if (!descriptionMeta) {
        descriptionMeta = document.createElement("meta");
        descriptionMeta.name = "description";
        descriptionMeta.setAttribute("data-app", "1");
        document.head.appendChild(descriptionMeta);
        createdDescription = true;
      }
      descriptionMeta.content = description;
    }

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"][data-app]');
    let createdCanonical = false;
    if (!noindex) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        canonical.setAttribute("data-app", "1");
        document.head.appendChild(canonical);
        createdCanonical = true;
      }
      canonical.href = `${window.location.origin}${window.location.pathname}`;
    }

    return () => {
      if (noindex) robots?.remove();
      if (description && descriptionMeta) {
        if (createdDescription) descriptionMeta.remove();
        else if (previousDescription !== undefined) descriptionMeta.content = previousDescription;
      }
      if (createdCanonical) canonical?.remove();
    };
  }, [title, noindex, description]);
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
