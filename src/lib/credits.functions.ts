import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FREE_GENERATIONS_TOTAL = 3;

export const CREDIT_PACKS = [
  { id: "starter", credits: 50, price: "$9", blurb: "Great for a single brand" },
  { id: "pro", credits: 200, price: "$29", blurb: "Best value for agencies" },
] as const;

// Multi-location bundles: 50 generations per office at 20% off the $9 single price
export const OFFICE_BUNDLES = [
  { id: "offices3", offices: 3, credits: 150, price: "$21.60", was: "$27", blurb: "3 locations" },
  { id: "offices5", offices: 5, credits: 250, price: "$36", was: "$45", blurb: "5 locations" },
  { id: "offices10", offices: 10, credits: 500, price: "$72", was: "$90", blurb: "10 locations" },
] as const;

export type CreditStatus = {
  credits: number;
  freeRemaining: number;
  canGenerate: boolean;
  unlimited: boolean;
};

export const getCreditStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CreditStatus> => {
    const { data, error } = await context.supabase.rpc("get_credit_status", {
      _user_id: context.userId,
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    const unlimited = Boolean((row as { unlimited?: boolean } | undefined)?.unlimited);
    const credits = row?.credits ?? 0;
    const freeRemaining = row?.free_remaining ?? 0;
    return {
      credits,
      freeRemaining,
      unlimited,
      canGenerate: unlimited || credits > 0 || freeRemaining > 0,
    };
  });
