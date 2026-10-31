import { createFileRoute } from "@tanstack/react-router";
import { LiveDataPage, liveLoaders } from "@/components/LiveDataPage";
import { StockAdjustmentDialog } from "@/components/StockAdjustmentDialog";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/inventory")({ component: Inventory });

function Inventory() {
  const { can, isAdmin } = useAuth();
  return (
    <LiveDataPage
      title="Inventory"
      description="Live stock, average buying price, selling price, and inventory value calculated from batches."
      load={liveLoaders.inventory}
      actions={can("manage_stock") ? <StockAdjustmentDialog /> : undefined}
      maxColumns={8}
      showSerialNumber
      compactTable
      hiddenColumns={isAdmin ? [] : ["stock_value_paisa"]}
      columnLabels={{
        medicine: "Medicine",
        base_unit: "Unit",
        stock: "In stock",
        minimum_stock: "Min.",
        average_buying_price_paisa: "Avg. buy",
        selling_price_paisa: "Sale",
        stock_value_paisa: "Stock value",
        nearest_expiry: "Expiry",
      }}
    />
  );
}
