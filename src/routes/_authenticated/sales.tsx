import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/sales")({
  head: () => ({
    meta: [
      { title: "Sales History — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Sales History for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Sales History — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Sales History for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Sales History" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Sales History will be available in the next build step." />
    </div>
  );
}
