"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as DeferredPrompt);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    return () => window.removeEventListener("beforeinstallprompt", handlePrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      setDeferred(null);
    } else {
      setVisible(false);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex w-[90%] max-w-sm -translate-x-1/2 items-center justify-between rounded-xl border border-white/10 bg-slate-900/90 p-4 text-xs text-white shadow-lg">
      <div>
        <div className="text-sm font-semibold">Install Gamified Mandala</div>
        <div className="text-white/70">Add this app to your home screen.</div>
      </div>
      <Button size="sm" onClick={handleInstall}>Install</Button>
    </div>
  );
}
