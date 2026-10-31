import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
export const Route = createFileRoute("/_authenticated/expiring")({
  component: () => (
    <LiveDataPage
      title="Expiring Medicines"
      description="Batch expiry dates and remaining quantities."
      load={liveLoaders.batches}
    />
  ),
});
