import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, LoadingRows } from "@/components/ui-kit";

export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingRows rows={4} />
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={<ShieldCheck className="size-7" />}
            title="Admin access only"
            description="Financial information is private and only available to the clinic administrator."
          />
        </CardContent>
      </Card>
    );
  }

  return children;
}
