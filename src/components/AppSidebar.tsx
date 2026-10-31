import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Pill,
  Boxes,
  TriangleAlert,
  CalendarClock,
  Truck,
  PackagePlus,
  History,
  Users,
  Receipt,
  Undo2,
  BarChart3,
  Wallet,
  UserCog,
  Settings,
  ScrollText,
  FlaskConical,
  TestTubes,
  ChevronDown,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { BrandLockup } from "@/components/Logo";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAuth, type Capability } from "@/hooks/useAuth";

type Item = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  capability?: Capability;
  adminOnly?: boolean;
};

type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      { title: "New Sale", url: "/pos", icon: ShoppingCart, capability: "sell" },
    ],
  },
  {
    label: "Pharmacy",
    items: [
      { title: "Medicine Catalog", url: "/medicines", icon: Pill },
      { title: "Inventory", url: "/inventory", icon: Boxes },
      { title: "Low Stock", url: "/low-stock", icon: TriangleAlert },
      { title: "Expiring Medicines", url: "/expiring", icon: CalendarClock },
    ],
  },
  {
    label: "Purchases",
    items: [
      {
        title: "New Purchase",
        url: "/purchases/new",
        icon: PackagePlus,
        capability: "manage_purchases",
      },
      {
        title: "Purchase History",
        url: "/purchases",
        icon: History,
        capability: "manage_purchases",
      },
      { title: "Suppliers", url: "/suppliers", icon: Truck, capability: "manage_purchases" },
    ],
  },
  {
    label: "Clinic",
    items: [
      { title: "Patients", url: "/patients", icon: Users },
      { title: "Sales History", url: "/sales", icon: Receipt, adminOnly: true },
      { title: "Returns", url: "/returns", icon: Undo2 },
    ],
  },
  {
    label: "Laboratory",
    items: [
      {
        title: "New Lab Sale",
        url: "/labs/new",
        icon: FlaskConical,
        capability: "sell_labs",
      },
      {
        title: "Lab Sales",
        url: "/labs",
        icon: Receipt,
        capability: "sell_labs",
      },
      {
        title: "Lab Test Catalogue",
        url: "/lab-tests",
        icon: TestTubes,
        capability: "manage_labs",
      },
    ],
  },
  {
    label: "Management",
    items: [
      {
        title: "Reports",
        url: "/reports",
        icon: BarChart3,
        capability: "view_reports",
        adminOnly: true,
      },
      { title: "Expenses", url: "/expenses", icon: Wallet, capability: "manage_expenses" },
      { title: "Users", url: "/users", icon: UserCog, capability: "manage_users" },
      { title: "Audit Log", url: "/audit", icon: ScrollText, capability: "view_audit" },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

const GROUP_STATE_KEY = "alshifa-sidebar-groups";

function itemIsActive(item: Item, pathname: string) {
  return (
    pathname === item.url ||
    (item.url !== "/purchases" && pathname.startsWith(item.url + "/")) ||
    (item.url === "/purchases" && pathname === "/purchases")
  );
}

function initialGroupState(pathname: string) {
  return Object.fromEntries(
    GROUPS.map((group) => [group.label, group.items.some((item) => itemIsActive(item, pathname))]),
  );
}

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can, isAdmin } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    initialGroupState(pathname),
  );

  useEffect(() => {
    let saved: Record<string, boolean> = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(GROUP_STATE_KEY) ?? "{}") as Record<
        string,
        boolean
      >;
    } catch {
      saved = {};
    }

    setOpenGroups((current) => {
      const next = { ...current, ...saved };
      const activeGroup = GROUPS.find((group) =>
        group.items.some((item) => itemIsActive(item, pathname)),
      );
      if (activeGroup) next[activeGroup.label] = true;
      return next;
    });
  }, [pathname]);

  const setGroupOpen = (label: string, open: boolean) => {
    setOpenGroups((current) => {
      const next = { ...current, [label]: open };
      try {
        window.localStorage.setItem(GROUP_STATE_KEY, JSON.stringify(next));
      } catch {
        // The sidebar still works if private browsing blocks local storage.
      }
      return next;
    });
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3">
        <BrandLockup compact={collapsed} invert />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {GROUPS.map((group) => {
          const items = group.items.filter(
            (item) => (!item.capability || can(item.capability)) && (!item.adminOnly || isAdmin),
          );
          if (items.length === 0) return null;
          return (
            <Collapsible
              key={group.label}
              open={collapsed || Boolean(openGroups[group.label])}
              onOpenChange={(open) => setGroupOpen(group.label, open)}
              className="group/sidebar-section"
            >
              <SidebarGroup className="py-1.5">
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger
                    aria-label={`${openGroups[group.label] ? "Collapse" : "Expand"} ${group.label}`}
                    className="w-full cursor-pointer justify-between text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&[data-state=open]>svg]:rotate-180"
                  >
                    <span>{group.label}</span>
                    <ChevronDown className="size-3.5 transition-transform duration-200" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent className="overflow-hidden">
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {items.map((item) => {
                        const active = itemIsActive(item, pathname);
                        return (
                          <SidebarMenuItem key={item.url}>
                            <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                              <Link
                                to={item.url}
                                onClick={() => isMobile && setOpenMobile(false)}
                                className="flex items-center gap-2"
                              >
                                <item.icon className="size-4 shrink-0" />
                                <span className="truncate">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
