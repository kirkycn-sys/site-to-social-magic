import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PLATFORMS } from "@/lib/generate.functions";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Your generations — SiteToSocial" },
      { name: "description", content: "Every batch of social posts you've generated." },
      { property: "og:title", content: "Your generations — SiteToSocial" },
      { property: "og:description", content: "Revisit and copy your saved social posts." },
    ],
  }),
  component: HistoryPage,
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Couldn't load your history.</p>
    </AppShell>
  ),
});

function platformLabel(id: string) {
  return PLATFORMS.find((p) => p.id === id)?.label ?? id;
}

function HistoryPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["generations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generations")
        .select("id, url, site_title, platform, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">History</h1>
      <p className="mt-2 text-sm text-muted-foreground">Every batch you've generated.</p>

      <div className="mt-6 space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl border border-border bg-card" />
          ))}

        {data?.length === 0 && (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Nothing yet. Generate your first batch from the home screen.
          </p>
        )}

        {data?.map((gen) => (
          <Link
            key={gen.id}
            to="/g/$id"
            params={{ id: gen.id }}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-primary/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-sm font-semibold">
                {gen.site_title || gen.url}
              </p>
              <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="rounded-full bg-secondary px-2 py-0.5">
                  {platformLabel(gen.platform)}
                </span>
                <Clock className="size-3" />
                {new Date(gen.created_at).toLocaleDateString()}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
