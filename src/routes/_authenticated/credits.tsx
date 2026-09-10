import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Sparkles, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { useStripeCheckout } from "@/hooks/useStripeCheckout";
import {
  CREDIT_PACKS,
  FREE_GENERATIONS_TOTAL,
  getCreditStatus,
} from "@/lib/credits.functions";

const PACK_PRICE_IDS: Record<string, string> = {
  starter: "credits_50_pack",
  pro: "credits_200_pack",
};

export const Route = createFileRoute("/_authenticated/credits")({
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => {
    const raw = search["session_id"];
    return typeof raw === "string" ? { session_id: raw } : {};
  },
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
        content: "3 free lifetime generations plus credit packs for heavy social posting.",
      },
    ],
  }),
  component: CreditsPage,
});

function CreditsPage() {
  const fetchStatus = useServerFn(getCreditStatus);
  const queryClient = useQueryClient();
  const { session_id: sessionId } = Route.useSearch();
  const { data, isLoading } = useQuery({
    queryKey: ["credit-status"],
    queryFn: () => fetchStatus(),
  });
  const { openCheckout, closeCheckout, isOpen, checkoutElement } = useStripeCheckout();

  useEffect(() => {
    if (!sessionId) return;
    queryClient.invalidateQueries({ queryKey: ["credit-status"] });
    toast.success("Payment received — your credits will appear in a moment.");
  }, [sessionId, queryClient]);

  const buy = (packId: string) => {
    const priceId = PACK_PRICE_IDS[packId];
    if (!priceId) return;
    openCheckout({
      priceId,
      returnUrl: `${window.location.origin}/credits?session_id={CHECKOUT_SESSION_ID}`,
    });
  };

  return (
    <AppShell>
      <PaymentTestModeBanner />
      <h1 className="font-display text-2xl font-bold">Credits &amp; plans</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Every account gets {FREE_GENERATIONS_TOTAL} free generations in total (one time, no daily reset). Need more? Credit
        packs never expire.
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Free left</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {isLoading
              ? "—"
              : data?.unlimited
                ? "∞"
                : `${data?.freeRemaining ?? 0}/${FREE_GENERATIONS_TOTAL}`}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Credits</p>
          <p className="mt-1 font-display text-2xl font-bold">
            {isLoading ? "—" : data?.unlimited ? "Unlimited" : (data?.credits ?? 0)}
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
              onClick={() => buy(pack.id)}
            >
              <Zap className="size-4" /> {pack.price}
            </Button>
          </div>
        ))}
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm sm:items-center">
          <div className="relative w-full max-w-lg p-3">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-5 top-5 z-10 rounded-full bg-card"
              onClick={() => {
                closeCheckout();
                queryClient.invalidateQueries({ queryKey: ["credit-status"] });
              }}
              aria-label="Close checkout"
            >
              <X className="size-4" />
            </Button>
            {checkoutElement}
          </div>
        </div>
      )}

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
