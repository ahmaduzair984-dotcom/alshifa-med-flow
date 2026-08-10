import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/pharmacy";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isPharmacist: boolean;
  can: (capability: Capability) => boolean;
  fullName: string;
  refresh: () => Promise<void>;
};

export type Capability =
  | "sell"
  | "manage_catalog"
  | "manage_stock"
  | "manage_purchases"
  | "manage_expenses"
  | "view_reports"
  | "manage_users"
  | "view_audit"
  | "manage_settings";

const CAPABILITIES: Record<AppRole, Capability[]> = {
  admin: [
    "sell",
    "manage_catalog",
    "manage_stock",
    "manage_purchases",
    "manage_expenses",
    "view_reports",
    "manage_users",
    "view_audit",
    "manage_settings",
  ],
  manager: ["manage_catalog", "manage_stock", "manage_purchases", "manage_expenses", "view_reports"],
  pharmacist: ["sell"],
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      setFullName("");
      return;
    }
    const [{ data: roleRows }, { data: profile }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    ]);
    setRoles((roleRows ?? []).map((r) => r.role as AppRole));
    setFullName(profile?.full_name ?? "");
  };

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      void loadProfile(nextSession?.user?.id);
    });
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadProfile(data.session?.user?.id);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const allowed = new Set<Capability>();
    roles.forEach((role) => CAPABILITIES[role]?.forEach((c) => allowed.add(c)));
    return {
      user: session?.user ?? null,
      session,
      roles,
      loading,
      isAdmin: roles.includes("admin"),
      isManager: roles.includes("manager"),
      isPharmacist: roles.includes("pharmacist"),
      can: (capability) => allowed.has(capability),
      fullName,
      refresh: async () => loadProfile(session?.user?.id),
    };
  }, [session, roles, loading, fullName]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
