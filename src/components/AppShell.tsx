import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { History, LogOut, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background bg-brand-glow">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary">
              <Sparkles className="size-4 text-primary-foreground" />
            </span>
            <span className="font-display text-base font-bold tracking-tight">
              Site<span className="text-gradient-brand">To</span>Social
            </span>
          </Link>
          <div className="flex items-center gap-1">
            {user ? (
              <>
                <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground">
                  <Link to="/credits">
                    <Zap className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-muted-foreground">
                  <Link to="/history">
                    <History className="size-4" />
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2 text-muted-foreground"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    navigate({ to: "/" });
                  }}
                >
                  <LogOut className="size-4" />
                </Button>
              </>
            ) : (
              <Button asChild size="sm" className="h-8">
                <Link to="/auth">Sign in</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 pb-16 pt-6">{children}</main>
    </div>
  );
}
