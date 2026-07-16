"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Inbox,
  Settings,
  Sparkles,
  Wrench,
} from "lucide-react";

type AppShellProps = {
  children: React.ReactNode;
};

const navItems = [
  {
    label: "Atelier",
    href: "/atelier",
    icon: Sparkles,
    match: ["/atelier"],
  },
  {
    label: "Inbox SAV",
    href: "/inbox-sav",
    icon: Inbox,
    match: ["/inbox-sav"],
  },
  {
    label: "Chantiers",
    href: "/sav/sessions",
    icon: FileText,
    match: ["/sav/sessions"],
  },
  {
    label: "Paramètres",
    href: "/settings",
    icon: Settings,
    match: ["/settings"],
  },
];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isActive = (item: (typeof navItems)[number]) => {
    if (item.href === "/" && pathname === "/") return true;

    return item.match.some((m) => {
      if (m === "/") return pathname === "/";
      return pathname === m || pathname.startsWith(`${m}/`);
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-20 flex-col items-center border-r border-slate-200 bg-white">
        <div className="flex h-24 w-full items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-600 text-white shadow-sm">
            <Wrench className="h-6 w-6" strokeWidth={2.2} />
          </div>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-4 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);

            return (
              <Link
                key={item.label}
                href={item.href}
                title={item.label}
                className={[
                  "relative flex h-12 w-12 items-center justify-center rounded-2xl transition",
                  active
                    ? "bg-orange-50 text-orange-600"
                    : "text-slate-400 hover:bg-slate-50 hover:text-slate-700",
                ].join(" ")}
              >
                <Icon className="h-6 w-6" strokeWidth={2} />
                {active ? (
                  <span className="absolute -right-4 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-orange-600" />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex h-24 w-full items-center justify-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-900">
            WP
          </div>
        </div>
      </aside>

      <div className="min-h-screen pl-20">
        {children}
      </div>
    </div>
  );
}
