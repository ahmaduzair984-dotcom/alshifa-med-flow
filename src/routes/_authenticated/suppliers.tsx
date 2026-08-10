import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Suppliers for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Suppliers — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Suppliers for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Suppliers" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Suppliers will be available in the next build step." />
    </div>
  );
}
