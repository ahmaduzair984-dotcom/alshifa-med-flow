import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { BackupButton } from "@/components/BackupButton";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/settings")({ component: Settings });

function Settings() {
  const { isAdmin } = useAuth();
  return (
    <LiveDataPage
      title="Clinic Settings"
      description="Clinic branding and operational defaults saved in the database."
      load={liveLoaders.settings}
      actions={isAdmin ? <BackupButton /> : undefined}
    />
  );
}
