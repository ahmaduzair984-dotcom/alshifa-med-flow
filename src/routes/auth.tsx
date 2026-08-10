import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Logo } from "@/components/Logo";
import { friendlyError } from "@/lib/pharmacy";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Staff Sign In — Al Shifa Family Clinic Pharmacy" },
      {
        name: "description",
        content:
          "Secure staff sign in for the Al Shifa Family Clinic pharmacy management system.",
      },
      { property: "og:title", content: "Staff Sign In — Al Shifa Family Clinic" },
      {
        property: "og:description",
        content: "Secure staff sign in for the Al Shifa Family Clinic pharmacy system.",
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
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });
    setLoading(false);
    if (error) {
      toast.error(
        /invalid login/i.test(error.message)
          ? "Incorrect email or password."
          : friendlyError(error),
      );
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const signUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: String(form.get("email") ?? "").trim(),
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: String(form.get("full_name") ?? "").trim() },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(friendlyError(error));
      return;
    }
    if (data.session) {
      toast.success("Account created. Welcome to Al Shifa Family Clinic.");
      navigate({ to: "/dashboard", replace: true });
    } else {
      toast.success("Account created. Please check your email to confirm, then sign in.");
    }
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
        <div className="mb-6 flex flex-col items-center text-center">
          <Logo className="size-28" />
          <h1 className="mt-2 text-xl font-bold tracking-wide text-primary">
            AL SHIFA FAMILY CLINIC
          </h1>
          <p className="text-sm text-muted-foreground">Dr. Saqlain Abbas Chattha</p>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle>Staff access</CardTitle>
            <CardDescription>
              Sign in to manage the pharmacy, stock and sales.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="mb-4 grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="space-y-4" onSubmit={signIn}>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" required autoComplete="email" />
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
              </TabsContent>

              <TabsContent value="signup">
                <form className="space-y-4" onSubmit={signUp}>
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name">Full name</Label>
                    <Input id="full_name" name="full_name" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input id="signup-email" name="email" type="email" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      name="password"
                      type="password"
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                    Create account
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    The first account created becomes the clinic administrator. Later accounts
                    start as pharmacist and can be upgraded by the administrator.
                  </p>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
