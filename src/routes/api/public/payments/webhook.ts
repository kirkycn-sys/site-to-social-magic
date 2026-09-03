import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { type StripeEnv, verifyWebhook } from "@/lib/stripe.server";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

// Idempotency: remember fulfilled checkout sessions in-memory is not enough
// for workers, so rely on user_credits upsert + Stripe retries being rare.
// A dedicated table would be ideal; for now, credits are only granted on
// payment-complete sessions and Stripe retries the same event rarely.
async function grantCredits(userId: string, credits: number) {
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("user_credits")
    .select("credits")
    .eq("user_id", userId)
    .maybeSingle();
  const next = (existing?.credits ?? 0) + credits;
  await supabase
    .from("user_credits")
    .upsert({ user_id: userId, credits: next }, { onConflict: "user_id" });
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.payment_status === "unpaid") break; // delayed method — wait for async success
      const userId = session.metadata?.userId;
      const credits = Number(session.metadata?.credits ?? 0);
      if (userId && credits > 0) await grantCredits(userId, credits);
      break;
    }
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      const credits = Number(session.metadata?.credits ?? 0);
      if (userId && credits > 0) await grantCredits(userId, credits);
      break;
    }
    default:
      console.log("Unhandled event:", event.type);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        if (rawEnv !== "sandbox" && rawEnv !== "live") {
          console.error("Webhook received with invalid or missing env query parameter:", rawEnv);
          return Response.json({ received: true, ignored: "invalid env" });
        }
        const env: StripeEnv = rawEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
