import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CloudUpload, Loader2, WifiOff } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getOfflineQueueSummary,
  subscribeOfflineQueue,
  syncOfflineQueue,
  type OfflineQueueSummary,
} from "@/lib/offline-queue";

const EMPTY: OfflineQueueSummary = { pending: 0, failed: 0, total: 0 };

export function OfflineSyncStatus() {
  const [online, setOnline] = useState(true);
  const [summary, setSummary] = useState(EMPTY);
  const [syncing, setSyncing] = useState(false);
  const client = useQueryClient();

  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    setSummary(await getOfflineQueueSummary());
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) return;
    setSyncing(true);
    const result = await syncOfflineQueue();
    setSummary(result.summary);
    setSyncing(false);
    if (result.synced > 0) {
      toast.success(`${result.synced} saved change${result.synced === 1 ? "" : "s"} synchronized.`);
      await client.invalidateQueries();
    }
    if (result.summary.failed > 0) {
      toast.error(
        `${result.summary.failed} saved change${result.summary.failed === 1 ? " could" : "s could"} not be synchronized. The data is still stored on this device.`,
      );
    }
  }, [client]);

  useEffect(() => {
    const onQueueChange = () => void refresh();
    const onOffline = () => {
      setOnline(false);
      void refresh();
    };
    const onOnline = () => {
      setOnline(true);
      void syncNow();
    };
    const unsubscribe = subscribeOfflineQueue(onQueueChange);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    void refresh().then(() => {
      if (navigator.onLine) void syncNow();
    });
    return () => {
      unsubscribe();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh, syncNow]);

  if (online && summary.total === 0 && !syncing) return null;

  const failed = summary.failed > 0;
  return (
    <div
      className={`no-print border-b px-3 py-2 text-sm md:px-6 ${failed ? "border-destructive/30 bg-destructive/10" : online ? "border-info/30 bg-info/10" : "border-warning/30 bg-warning/10"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {failed ? (
            <AlertTriangle className="size-4 shrink-0 text-destructive" />
          ) : online ? (
            <CloudUpload className="size-4 shrink-0 text-info" />
          ) : (
            <WifiOff className="size-4 shrink-0 text-warning" />
          )}
          <p>
            {failed
              ? `${summary.failed} saved change${summary.failed === 1 ? " needs" : "s need"} attention. Your data remains on this device.`
              : online
                ? `${summary.total} saved change${summary.total === 1 ? " is" : "s are"} waiting to synchronize.`
                : `Offline mode${summary.total ? ` — ${summary.total} change${summary.total === 1 ? " is" : "s are"} safely saved on this device` : " — supported changes will be saved on this device"}.`}
          </p>
        </div>
        {online && summary.total > 0 ? (
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            disabled={syncing}
            onClick={() => void syncNow()}
          >
            {syncing ? (
              <Loader2 className="mr-1 size-3.5 animate-spin" />
            ) : (
              <CloudUpload className="mr-1 size-3.5" />
            )}
            {syncing ? "Syncing" : "Sync now"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
