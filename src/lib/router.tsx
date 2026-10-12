import { useSyncExternalStore, type AnchorHTMLAttributes, type MouseEvent } from "react";

const EVENT = "ulanganku:navigate";

export function navigate(to: string, options: { replace?: boolean } = {}) {
  const current = window.location.pathname + window.location.search;
  if (to !== current) {
    window.history[options.replace ? "replaceState" : "pushState"](null, "", to);
    window.dispatchEvent(new Event(EVENT));
  }
  window.scrollTo(0, 0);
}

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener(EVENT, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener(EVENT, callback);
  };
}

const snapshot = () => window.location.pathname + window.location.search;

export function useLocation() {
  const full = useSyncExternalStore(subscribe, snapshot, () => "/");
  const index = full.indexOf("?");
  const pathname = index === -1 ? full : full.slice(0, index);
  const search = index === -1 ? "" : full.slice(index);
  return { pathname, search, params: new URLSearchParams(search) };
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { to: string };

export function Link({ to, onClick, children, ...rest }: LinkProps) {
  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      rest.target === "_blank"
    ) {
      return;
    }
    event.preventDefault();
    navigate(to);
  }
  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
