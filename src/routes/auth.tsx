import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Logo } from "@/components/Logo";
import { friendlyError } from "@/lib/pharmacy";
import { credentialToAuthEmail } from "@/lib/staff-credentials";
import { DoctorProfile } from "@/components/DoctorProfile";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — Al Shifa Family Clinic Pharmacy" },
      {
        name: "description",
        content: "Secure username and password sign in for Al Shifa Family Clinic staff.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [navigate]);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = credentialToAuthEmail(String(form.get("username") ?? ""));
    if (!email) {
      toast.error("Enter the username given to you by the administrator.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: String(form.get("password") ?? ""),
    });
    if (error) {
      setLoading(false);
      toast.error(
        /invalid login/i.test(error.message)
          ? "Incorrect username or password."
          : friendlyError(error),
      );
      return;
    }

    const profile = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile.data?.is_active === false) {
      await supabase.auth.signOut({ scope: "local" });
      setLoading(false);
      toast.error("This staff account has been deactivated. Contact the administrator.");
      return;
    }

    setLoading(false);
    navigate({ to: "/dashboard", replace: true });
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted to-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-5 flex flex-col items-center text-center">
          <Logo className="size-24 sm:size-28" />
          <h1 className="mt-2 text-xl font-bold tracking-wide text-primary">
            AL SHIFA FAMILY CLINIC
          </h1>
          <DoctorProfile compact />
        </div>
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle>Staff access</CardTitle>
            <CardDescription>
              Sign in with the username and password given by the administrator.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={signIn}>
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="username"
                  placeholder="e.g. pharmacist1"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Sign in
              </Button>
            </form>
            <p className="mt-4 rounded-md bg-muted p-3 text-center text-xs text-muted-foreground">
              Forgotten credentials are reset by the clinic administrator. No invitation or recovery
              message is required.
            </p>
          </CardContent>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Developed by Ahmad Uzair Tarar
        </p>
      </div>
    </div>
  );
}
