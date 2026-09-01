import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const DAILY_FREE_GENERATIONS = 3;

export const CREDIT_PACKS = [
  { id: "starter", credits: 50, price: "$9", blurb: "Great for a single brand" },
  { id: "pro", credits: 200, price: "$29", blurb: "Best value for agencies" },
] as const;

export type CreditStatus = { credits: number; freeRemaining: number; canGenerate: boolean };

export const getCreditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditStatus> => {
    const { data, error } = await context.supabase.rpc("get_credit_status", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const credits = row?.credits ?? 0;
    const freeRemaining = row?.free_remaining ?? 0;
    return { credits, freeRemaining, canGenerate: credits > 0 || freeRemaining > 0 };
  });
