import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/purchases/new")({
  head: () => ({
    meta: [
      { title: "New Purchase — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "New Purchase for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "New Purchase — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "New Purchase for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="New Purchase" description="This section is being built next." />
      <EmptyState title="Coming up next" description="New Purchase will be available in the next build step." />
    </div>
  );
}
