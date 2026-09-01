import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { PostCard, type GeneratedPost } from "@/components/PostCard";
import { PLATFORMS } from "@/lib/generate.functions";

export const Route = createFileRoute("/_authenticated/g/$id")({
  head: () => ({
    meta: [
      { title: "Saved posts — SiteToSocial" },
      { name: "description", content: "A saved batch of 20 generated social posts." },
      { property: "og:title", content: "Saved posts — SiteToSocial" },
      { property: "og:description", content: "Review and copy your generated social posts." },
    ],
  }),
  component: GenerationPage,
  errorComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">Couldn't load this batch.</p>
    </AppShell>
  ),
  notFoundComponent: () => (
    <AppShell>
      <p className="text-sm text-muted-foreground">That batch doesn't exist.</p>
    </AppShell>
  ),
});

function GenerationPage() {
  const { id } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["generation", id],
    queryFn: async () => {
      const [gen, posts] = await Promise.all([
        supabase
          .from("generations")
          .select("id, url, site_title, site_summary, platform, created_at")
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("posts")
          .select("id, position, content, hashtags")
          .eq("generation_id", id)
          .order("position"),
      ]);
      if (gen.error) throw gen.error;
      if (posts.error) throw posts.error;
      return { generation: gen.data, posts: posts.data ?? [] };
    },
  });

  return (
    <AppShell>
      <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> History
      </Link>

      {isLoading && <div className="mt-6 h-24 animate-pulse rounded-2xl bg-card" />}

      {data?.generation && (
        <>
          <h1 className="mt-4 font-display text-xl font-bold">
            {data.generation.site_title || data.generation.url}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {PLATFORMS.find((p) => p.id === data.generation!.platform)?.label} ·{" "}
            {new Date(data.generation.created_at).toLocaleDateString()}
          </p>
          {data.generation.site_summary && (
            <p className="mt-4 rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              {data.generation.site_summary}
            </p>
          )}
          <div className="mt-5 space-y-3">
            {data.posts.map((post, index) => (
              <PostCard key={post.id} post={post as GeneratedPost} index={index} />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}
