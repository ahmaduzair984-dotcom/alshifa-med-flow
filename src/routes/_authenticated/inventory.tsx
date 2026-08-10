import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Inventory for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Inventory — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Inventory for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Inventory" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Inventory will be available in the next build step." />
    </div>
  );
}
