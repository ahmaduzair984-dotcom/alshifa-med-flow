import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { ReturnDetailsDialog, type ReturnHistoryRow } from "@/components/ReturnDialogs";
import { DirectReturnDialog } from "@/components/DirectReturnDialog";

export const Route = createFileRoute("/_authenticated/returns")({
  component: () => (
    <LiveDataPage
      title="Returns"
      description="Return medicine directly without an invoice. Stock, refunds, and profit are adjusted automatically."
      load={liveLoaders.returns}
      actions={<DirectReturnDialog />}
      rowActions={(row) => (
        <ReturnDetailsDialog returnRecord={row as unknown as ReturnHistoryRow} />
      )}
      deleteConfig={{ table: "sale_returns", recordLabel: "return" }}
    />
  ),
});
