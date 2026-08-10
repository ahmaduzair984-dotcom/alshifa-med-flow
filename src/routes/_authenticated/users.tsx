import { createFileRoute } from "@tanstack/react-router";
import { PageHeader, EmptyState } from "@/components/ui-kit";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users — Al Shifa Family Clinic Pharmacy" },
      { name: "description", content: "Users for Al Shifa Family Clinic pharmacy management." },
      { property: "og:title", content: "Users — Al Shifa Family Clinic Pharmacy" },
      { property: "og:description", content: "Users for Al Shifa Family Clinic pharmacy management." },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <div>
      <PageHeader title="Users" description="This section is being built next." />
      <EmptyState title="Coming up next" description="Users will be available in the next build step." />
    </div>
  );
}
