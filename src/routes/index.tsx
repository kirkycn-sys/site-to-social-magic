import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Link2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { PostCard, type GeneratedPost } from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/hooks/use-session";
import { PLATFORMS, generatePosts, type PlatformId } from "@/lib/generate.functions";
import { DAILY_FREE_GENERATIONS, getCreditStatus } from "@/lib/credits.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SiteToSocial — Turn a website into 20 social posts" },
      {
        name: "description",
        content:
          "Paste any website URL and instantly get 20 ready-to-publish posts written for X, LinkedIn, Instagram, Facebook or TikTok.",
      },
      { property: "og:title", content: "SiteToSocial — 20 posts from one link" },
      {
        property: "og:description",
        content: "Paste a link, pick a platform, get 20 publish-ready social posts.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [platform, setPlatform] = useState<PlatformId>("x");
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const generate = useServerFn(generatePosts);
  const fetchCredits = useServerFn(getCreditStatus);
  const queryClient = useQueryClient();

  const credits = useQuery({
    queryKey: ["credit-status"],
    queryFn: () => fetchCredits(),
    enabled: !!user,
  });

  const mutation = useMutation({
    mutationFn: (input: { url: string; platform: PlatformId }) => generate({ data: input }),
    onSuccess: (result) => {
      setPosts(result.posts as GeneratedPost[]);
      setSummary(result.generation.site_summary ?? null);
      toast.success(`${result.posts.length} posts ready`);
      queryClient.invalidateQueries({ queryKey: ["credit-status"] });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["credit-status"] });
      toast.error(error.message || "Generation failed");
    },
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    setPosts([]);
    setSummary(null);
    mutation.mutate({ url: url.trim(), platform });
  };

  return (
    <AppShell>
      <section className="pb-2">
        <h1 className="font-display text-[2rem] leading-[1.1] font-bold">
          One link in.
          <br />
          <span className="text-gradient-brand">Twenty posts out.</span>
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Drop in any website and SiteToSocial reads the page, then writes 20 publish-ready
          posts in the voice of your chosen platform.
        </p>
      </section>

      {user && credits.data && (
        <Link
          to="/credits"
          className="mt-5 flex items-center justify-between rounded-2xl border border-border bg-surface px-4 py-3 text-sm"
        >
          <span className="text-muted-foreground">
            {credits.data.freeRemaining > 0
              ? `${credits.data.freeRemaining} of ${DAILY_FREE_GENERATIONS} free generations left today`
              : credits.data.credits > 0
                ? `${credits.data.credits} credits left`
                : "Out of generations for today"}
          </span>
          <span className="font-medium text-accent">
            {credits.data.canGenerate ? "Plans" : "Get credits"}
          </span>
        </Link>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="relative">
          <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="yourwebsite.com"
            className="h-12 rounded-xl border-border bg-card pl-9 text-base"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const active = p.id === platform;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatform(p.id)}
                className={
                  active
                    ? "rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-glow transition"
                    : "rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground"
                }
              >
                {p.label}
              </button>
            );
          })}
        </div>

        <Button
          type="submit"
          disabled={
            mutation.isPending ||
            loading ||
            !url.trim() ||
            (!!user && credits.data ? !credits.data.canGenerate : false)
          }
          className="h-12 w-full rounded-xl text-base font-semibold shadow-glow"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Reading the site…
            </>
          ) : user ? (
            <>
              <Sparkles className="size-4" /> Generate 20 posts
            </>
          ) : (
            <>
              Sign in to generate <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </form>

      {mutation.isPending && (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
          ))}
        </div>
      )}

      {posts.length > 0 && (
        <section className="mt-8">
          {summary && (
            <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted-foreground">
              {summary}
            </p>
          )}
          <div className="mt-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Your 20 posts</h2>
            <Link to="/history" className="text-sm text-accent">
              History
            </Link>
          </div>
          <div className="mt-3 space-y-3">
            {posts.map((post, index) => (
              <PostCard key={post.id ?? index} post={post} index={index} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  );
}
