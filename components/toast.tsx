"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const DURATION = 5000;
const EXIT = 300;

export function Toast({ message, error = false }: { message?: string; error?: boolean }) {
  const [phase, setPhase] = useState<"in" | "out" | "gone">(message ? "in" : "gone");

  useEffect(() => {
    if (!message) return;
    const url = new URL(window.location.href);
    ["ok", "error", "t"].forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(null, "", url);
    const out = setTimeout(() => setPhase("out"), DURATION - EXIT);
    const gone = setTimeout(() => setPhase("gone"), DURATION);
    return () => {
      clearTimeout(out);
      clearTimeout(gone);
    };
  }, [message]);

  if (!message || phase === "gone") return null;
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "fixed right-4 bottom-4 left-4 z-50 rounded-lg border bg-popover px-4 py-3 text-sm shadow-lg duration-300 sm:left-auto sm:max-w-sm",
        error ? "border-destructive/50 text-destructive" : "border-primary/40 text-foreground",
        phase === "in" ? "animate-in fade-in slide-in-from-bottom-4" : "animate-out fade-out slide-out-to-bottom-4 fill-mode-forwards",
      )}
    >
      {message}
    </div>
  );
}
