import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const VIDEO_CREDIT_COST = 20;
export const VIDEO_BUCKET = "brand-videos";

const StartSchema = z.object({
  url: z.string().min(4).max(2000),
  vibe: z.enum(["cinematic", "energetic", "friendly", "premium"]).default("cinematic"),
});

const CheckSchema = z.object({ id: z.string().uuid() });

export const VIDEO_VIBES = [
  { id: "cinematic", label: "Cinematic", hint: "slow, filmic camera moves, shallow depth of field" },
  { id: "energetic", label: "Energetic", hint: "fast punchy motion, bright light, quick push-ins" },
  { id: "friendly", label: "Friendly", hint: "warm natural light, human, welcoming everyday moments" },
  { id: "premium", label: "Premium", hint: "luxurious, high contrast, elegant slow reveal" },
] as const;

function normalizeUrl(raw: string) {
  const trimmed = raw.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const parsed = new URL(withProtocol);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only http(s) links are supported.");
  }
  return parsed.toString();
}

function extractReadableText(html: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i,
  );
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return {
    title: titleMatch?.[1] ? titleMatch[1].replace(/\s+/g, " ").trim().slice(0, 200) : null,
    description: descMatch?.[1] ? descMatch[1].slice(0, 400) : null,
    body: text.slice(0, 10000),
  };
}

function extractOutputText(payload: unknown): string {
  const data = payload as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof data.output_text === "string" && data.output_text.trim()) return data.output_text;
  const chunks: string[] = [];
  for (const item of data.output ?? []) {
    for (const part of item.content ?? []) {
      if (typeof part.text === "string") chunks.push(part.text);
    }
  }
  return chunks.join("");
}

export const startVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");

    const url = normalizeUrl(data.url);
    const supabase = context.supabase;

    const { data: creditRows, error: creditError } = await supabase.rpc("consume_credits", {
      _amount: VIDEO_CREDIT_COST,
    });
    if (creditError) throw new Error(creditError.message);
    const credit = Array.isArray(creditRows) ? creditRows[0] : creditRows;
    if (!credit?.allowed) {
      throw new Error(
        `A video costs ${VIDEO_CREDIT_COST} credits. Top up on the Credits page to create one.`,
      );
    }
    const refund = async () => {
      await supabase.rpc("refund_credits", { _amount: VIDEO_CREDIT_COST });
    };

    try {
      let html = "";
      try {
        const res = await fetch(url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; SiteToSocialBot/1.0)" },
          signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`Site responded with ${res.status}`);
        html = await res.text();
      } catch {
        throw new Error("Couldn't read that website. Check the link and try again.");
      }

      const page = extractReadableText(html);
      if (page.body.length < 80) {
        throw new Error("That page didn't return enough readable content to work with.");
      }

      const vibe = VIDEO_VIBES.find((v) => v.id === data.vibe)!;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { "content-type": "application/json", "Lovable-API-Key": apiKey },
        body: JSON.stringify({
          model: "openai/gpt-5.4-mini",
          input: [
            {
              role: "system",
              content:
                "You are a commercial director. You turn a company's website into a single 8-second vertical video scene. Describe one continuous shot only: subject, setting, lighting, camera movement. Never invent claims that the page does not support. Never mention on-screen text, logos, captions, phone numbers or watermarks in the video prompt.",
            },
            {
              role: "user",
              content: [
                `Website: ${url}`,
                `Page title: ${page.title ?? "unknown"}`,
                `Meta description: ${page.description ?? "none"}`,
                `Desired mood: ${vibe.label} — ${vibe.hint}`,
                "",
                "Return a headline of at most 45 characters for the on-screen banner, and a single-scene video prompt of 40-70 words in English.",
                "",
                "PAGE CONTENT:",
                page.body,
              ].join("\n"),
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "video_brief",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: { headline: { type: "string" }, prompt: { type: "string" } },
                required: ["headline", "prompt"],
              },
            },
          },
        }),
      });

      if (!aiRes.ok) {
        if (aiRes.status === 429) {
          throw new Error("Too many requests right now — wait a moment and try again.");
        }
        if (aiRes.status === 402) {
          throw new Error("AI credits are exhausted. Add credits in Lovable to keep generating.");
        }
        throw new Error(`Could not write the video brief (${aiRes.status}).`);
      }

      const brief = JSON.parse(extractOutputText(await aiRes.json())) as {
        headline: string;
        prompt: string;
      };
      if (!brief.prompt?.trim()) throw new Error("The AI returned an empty video brief.");

      const jobRes = await fetch("https://ai.gateway.lovable.dev/v1/videos", {
        method: "POST",
        headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/veo-3.1-lite",
          instances: [{ prompt: brief.prompt.trim() }],
          parameters: {
            durationSeconds: 8,
            resolution: "720p",
            aspectRatio: "9:16",
            sampleCount: 1,
            generateAudio: true,
          },
        }),
      });

      if (!jobRes.ok) {
        const detail = await jobRes.text();
        if (jobRes.status === 429) {
          throw new Error(
            "A video is already rendering for this app. Wait for it to finish, then try again.",
          );
        }
        if (jobRes.status === 402) {
          throw new Error("Video generation is out of AI credits right now. Try again later.");
        }
        throw new Error(`Video generation failed (${jobRes.status}). ${detail.slice(0, 160)}`);
      }

      const job = (await jobRes.json()) as { id: string };

      const { data: row, error: insertError } = await supabase
        .from("videos")
        .insert({
          user_id: context.userId,
          url,
          site_title: page.title,
          headline: brief.headline?.slice(0, 60) ?? null,
          prompt: brief.prompt.trim(),
          job_id: job.id,
          status: "processing",
          credits_spent: VIDEO_CREDIT_COST,
        })
        .select("id, status, headline, url, created_at")
        .single();
      if (insertError || !row) throw new Error(insertError?.message ?? "Could not save the video.");

      return row;
    } catch (err) {
      await refund();
      throw err;
    }
  });

export const checkVideo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");
    const supabase = context.supabase;

    const { data: row, error } = await supabase
      .from("videos")
      .select("id, status, job_id, storage_path, error, credits_spent")
      .eq("id", data.id)
      .single();
    if (error || !row) throw new Error("Video not found.");
    if (row.status !== "processing" || !row.job_id) {
      return { status: row.status, storagePath: row.storage_path, error: row.error };
    }

    const jobRes = await fetch(`https://ai.gateway.lovable.dev/v1/videos/${row.job_id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!jobRes.ok) return { status: "processing", storagePath: null, error: null };

    const job = (await jobRes.json()) as {
      status: string;
      error?: { message?: string };
    };

    if (job.status === "failed") {
      await supabase.rpc("refund_credits", { _amount: row.credits_spent || VIDEO_CREDIT_COST });
      const message = job.error?.message ?? "The video could not be generated.";
      await supabase
        .from("videos")
        .update({ status: "failed", error: message })
        .eq("id", row.id);
      return { status: "failed", storagePath: null, error: message };
    }

    if (job.status !== "completed") {
      return { status: "processing", storagePath: null, error: null };
    }

    const contentRes = await fetch(
      `https://ai.gateway.lovable.dev/v1/videos/${row.job_id}/content`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!contentRes.ok) return { status: "processing", storagePath: null, error: null };

    const bytes = await contentRes.arrayBuffer();
    const storagePath = `${context.userId}/${row.id}.mp4`;
    const { error: uploadError } = await supabase.storage
      .from(VIDEO_BUCKET)
      .upload(storagePath, bytes, { contentType: "video/mp4", upsert: true });
    if (uploadError) throw new Error(uploadError.message);

    await supabase
      .from("videos")
      .update({ status: "ready", storage_path: storagePath })
      .eq("id", row.id);

    return { status: "ready", storagePath, error: null };
  });
