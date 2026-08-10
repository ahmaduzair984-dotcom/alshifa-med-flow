import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/purchases/")({
  head: () => ({
    meta: [
      { title: "Purchase History — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Purchase History for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Purchase History — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Purchase History for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Purchase History" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Purchase History will be available in the next build step." />
    </div>
  );
}
