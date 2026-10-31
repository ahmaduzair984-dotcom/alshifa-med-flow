import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let reloading = false;
    let updateTimer: number | undefined;
    const hadController = Boolean(navigator.serviceWorker.controller);
    const reloadOnUpdate = () => {
      if (!hadController || reloading) return;
      reloading = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", reloadOnUpdate);

    void navigator.serviceWorker
      .register("/service-worker.js", { updateViaCache: "none" })
      .then((registration) => {
        const checkForUpdate = () => void registration.update().catch(() => undefined);
        checkForUpdate();
        updateTimer = window.setInterval(checkForUpdate, 5 * 60 * 1000);
        const updateWhenVisible = () => {
          if (document.visibilityState === "visible") checkForUpdate();
        };
        document.addEventListener("visibilitychange", updateWhenVisible);
        window.addEventListener("online", checkForUpdate);

        return () => {
          document.removeEventListener("visibilitychange", updateWhenVisible);
          window.removeEventListener("online", checkForUpdate);
        };
      })
      .then((removeUpdateListeners) => {
        if (!removeUpdateListeners) return;
        // Save the cleanup function on the effect's closure after registration.
        cleanupUpdateListeners = removeUpdateListeners;
      })
      .catch(() => undefined);

    let cleanupUpdateListeners: (() => void) | undefined;
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", reloadOnUpdate);
      if (updateTimer) window.clearInterval(updateTimer);
      cleanupUpdateListeners?.();
    };
  }, []);
  return null;
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  useEffect(() => {
    const capturePrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);
  if (!installPrompt) return null;

  const install = async () => {
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  return (
    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => void install()}>
      <Download className="mr-1 size-3.5" /> Install
    </Button>
  );
}
