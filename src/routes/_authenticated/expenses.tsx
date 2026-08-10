import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Expenses for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Expenses — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Expenses for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Expenses" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Expenses will be available in the next build step." />
    </div>
  );
}
