import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
export const Route = createFileRoute("/_authenticated/audit")({
  component: () => (
    <LiveDataPage
      title="Audit Log"
      description="Read-only record of important clinic activity."
      load={liveLoaders.audit}
    />
  ),
});
