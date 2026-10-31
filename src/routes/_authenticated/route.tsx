import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut, User as UserIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/AppSidebar";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { InstallAppButton } from "@/components/PwaControls";
import { isNetworkFailure } from "@/lib/offline-queue";
import { OfflineSyncStatus } from "@/components/OfflineSyncStatus";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) throw redirect({ to: "/auth" });
    if (!navigator.onLine) return { user: sessionData.session.user };

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (isNetworkFailure(error)) return { user: sessionData.session.user };
      throw redirect({ to: "/auth" });
    }
    if (!data.user) throw redirect({ to: "/auth" });
    const profile = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile.data?.is_active === false) {
      await supabase.auth.signOut({ scope: "local" });
      throw redirect({ to: "/auth" });
    }
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full bg-background">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <Header />
            <OfflineSyncStatus />
            <main className="flex-1 p-3 sm:p-4 md:p-6">
              <Outlet />
            </main>
            <footer className="px-3 pb-3 text-center text-xs text-muted-foreground sm:px-4 md:px-6">
              Pharmacy management software developed by Ahmad Uzair Tarar
            </footer>
          </div>
        </div>
      </SidebarProvider>
    </AuthProvider>
  );
}

function Header() {
  const { roles, fullName } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-card/80 px-3 backdrop-blur md:px-6">
      <SidebarTrigger />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">Al Shifa Pharmacy</p>
      </div>
      <InstallAppButton />
      <div className="hidden gap-1 sm:flex">
        {roles.map((role) => (
          <Badge key={role} variant="secondary" className="capitalize">
            {role}
          </Badge>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Account menu">
            <UserIcon className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{fullName || "Staff account"}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={signOut}>
            <LogOut className="mr-2 size-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
