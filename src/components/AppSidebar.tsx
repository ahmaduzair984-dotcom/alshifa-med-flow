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
import { useAuth, type Capability } from "@/hooks/useAuth";

type Item = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  capability?: Capability;
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
      { title: "New Purchase", url: "/purchases/new", icon: PackagePlus, capability: "manage_purchases" },
      { title: "Purchase History", url: "/purchases", icon: History, capability: "manage_purchases" },
      { title: "Suppliers", url: "/suppliers", icon: Truck, capability: "manage_purchases" },
    ],
  },
  {
    label: "Clinic",
    items: [
      { title: "Patients", url: "/patients", icon: Users },
      { title: "Sales History", url: "/sales", icon: Receipt },
      { title: "Returns", url: "/returns", icon: Undo2 },
    ],
  },
  {
    label: "Management",
    items: [
      { title: "Reports", url: "/reports", icon: BarChart3, capability: "view_reports" },
      { title: "Expenses", url: "/expenses", icon: Wallet, capability: "manage_expenses" },
      { title: "Users", url: "/users", icon: UserCog, capability: "manage_users" },
      { title: "Audit Log", url: "/audit", icon: ScrollText, capability: "view_audit" },
      { title: "Settings", url: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state, setOpenMobile, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { can } = useAuth();

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3">
        <BrandLockup compact={collapsed} invert />
      </SidebarHeader>
      <SidebarContent className="gap-0">
        {GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.capability || can(item.capability));
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.label}>
              {!collapsed && (
                <SidebarGroupLabel className="text-sidebar-foreground/50">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const active =
                      pathname === item.url ||
                      (item.url !== "/purchases" && pathname.startsWith(item.url + "/")) ||
                      (item.url === "/purchases" && pathname === "/purchases");
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
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
