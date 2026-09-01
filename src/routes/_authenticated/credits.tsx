import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Check, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  CREDIT_PACKS,
  DAILY_FREE_GENERATIONS,
  getCreditStatus,
} from "@/lib/credits.functions";

export const Route = createFileRoute("/_authenticated/credits")({
  head: () => ({
    meta: [
      { title: "Credits & plans — SiteToSocial" },
      {
        name: "description",
        content:
          "Check your remaining free generations, see your credit balance and top up with a SiteToSocial credit pack.",
      },
      { property: "og:title", content: "Credits & plans — SiteToSocial" },
      {
        property: "og:description",
        content: "Free daily generations plus credit packs for heavy social posting.",
      },
    ],
  }),
  component: CreditsPage,
});

function CreditsPage() {
  const fetchStatus = useServerFn(getCreditStatus);
  const { data, isLoading } = useQuery({
    queryKey: ["credit-status"],
    queryFn: () => fetchStatus(),
  });

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Credits &amp; plans</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every account gets {DAILY_FREE_GENERATIONS} free generations a day. Need more? Credit
        packs never expire.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Free today</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {isLoading ? "—" : `${data?.freeRemaining ?? 0}/${DAILY_FREE_GENERATIONS}`}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Credits</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {isLoading ? "—" : (data?.credits ?? 0)}
          </p>
        </div>
      </div>

      <h2 className="mt-8 font-display text-lg font-semibold">Top up</h2>
      <div className="mt-3 space-y-3">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4"
          >
            <div>
              <p className="font-display text-base font-semibold">
                {pack.credits} generations
              </p>
              <p className="text-xs text-muted-foreground">{pack.blurb}</p>
            </div>
            <Button
              size="sm"
              className="rounded-xl"
              onClick={() =>
                toast.info("Checkout isn't connected yet — ask to enable payments.")
              }
            >
              <Zap className="size-4" /> {pack.price}
            </Button>
          </div>
        ))}
      </div>

      <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
        {[
          "All five platforms included",
          "20 posts per generation",
          "Full saved history",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Check className="size-4 text-accent" /> {item}
          </li>
        ))}
      </ul>

      <p className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Sparkles className="size-3.5" /> Credits are only spent on successful generations.
      </p>
    </AppShell>
  );
}
