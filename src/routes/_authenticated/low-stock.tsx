import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
export const Route = createFileRoute("/_authenticated/low-stock")({
  component: () => (
    <LiveDataPage
      title="Low Stock"
      description="Medicines at or below their configured minimum stock level."
      load={liveLoaders.lowStock}
    />
  ),
});
