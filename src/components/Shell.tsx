import { Link, useRouterState } from "@tanstack/react-router";
import { AudioLines, LibraryBig, SlidersHorizontal, LogOut, Youtube, ListMusic } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/deck", label: "Live Deck", icon: AudioLines },
  { to: "/library", label: "Library", icon: LibraryBig },
  { to: "/studio", label: "Studio", icon: SlidersHorizontal },
  { to: "/sync", label: "Sync", icon: Youtube },
  { to: "/sessions", label: "Sessions", icon: ListMusic },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-panel/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-4">
          <Link to="/deck" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <AudioLines className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold uppercase tracking-[0.2em]">WhistleDeck</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-sm px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors",
                    active
                      ? "bg-panel-raised text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            onClick={() => void supabase.auth.signOut()}
            className="ml-auto flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6">{children}</main>
    </div>
  );
}
