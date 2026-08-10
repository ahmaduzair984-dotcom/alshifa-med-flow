import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "Point of Sale — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Point of Sale for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Point of Sale — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Point of Sale for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Point of Sale" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Point of Sale will be available in the next build step." />
    </div>
  );
}
