import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const PLATFORMS = [
  { id: "x", label: "X / Twitter", hint: "Under 260 characters, punchy, 1-2 hashtags." },
  { id: "linkedin", label: "LinkedIn", hint: "2-4 short professional lines, insight-led, no emoji spam." },
  { id: "instagram", label: "Instagram", hint: "Warm caption with line breaks, emoji-friendly, 4-6 hashtags." },
  { id: "facebook", label: "Facebook", hint: "Conversational 2-3 sentences, one clear call to action." },
  { id: "tiktok", label: "TikTok", hint: "Hook-first one-liner script idea, trend-aware, 3-5 hashtags." },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]["id"];

const InputSchema = z.object({
  url: z.string().min(4).max(2000),
  platform: z.enum(["x", "linkedin", "instagram", "facebook", "tiktok"]),
});

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

    body: text.slice(0, 12000),
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

export const generatePosts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");

    const url = normalizeUrl(data.url);

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

    const platform = PLATFORMS.find((p) => p.id === data.platform)!;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "openai/gpt-5.4-mini",
        input: [
          {
            role: "system",
            content:
              "You are a senior social media strategist. You turn website content into ready-to-publish posts. Never invent facts that are not supported by the page content. Vary angle, format and hook across posts.",
          },
          {
            role: "user",
            content: [
              `Website: ${url}`,
              `Page title: ${page.title ?? "unknown"}`,
              `Meta description: ${page.description ?? "none"}`,
              `Target platform: ${platform.label}. Style rules: ${platform.hint}`,
              "",
              "Write exactly 20 distinct posts for this platform, plus a one-sentence summary of what the site offers.",
              "Hashtags go in the hashtags array (no leading #), not inside the post text.",
              "",
              "PAGE CONTENT:",
              page.body,
            ].join("\n"),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "social_posts",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                summary: { type: "string" },
                posts: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      content: { type: "string" },
                      hashtags: { type: "array", items: { type: "string" } },
                    },
                    required: ["content", "hashtags"],
                  },
                },
              },
              required: ["summary", "posts"],
            },
          },
        },
      }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      if (aiRes.status === 429) {
        throw new Error("Too many requests right now — wait a moment and try again.");
      }
      if (aiRes.status === 402) {
        throw new Error("AI credits are exhausted. Add credits in Lovable to keep generating.");
      }
      throw new Error(`AI generation failed (${aiRes.status}). ${detail.slice(0, 200)}`);
    }

    const parsed = JSON.parse(extractOutputText(await aiRes.json())) as {
      summary: string;
      posts: Array<{ content: string; hashtags: string[] }>;
    };

    const posts = parsed.posts.filter((p) => p.content?.trim()).slice(0, 20);
    if (posts.length === 0) throw new Error("The AI returned no usable posts. Try again.");

    const supabase = context.supabase;
    const { data: generation, error: genError } = await supabase
      .from("generations")
      .insert({
        user_id: context.userId,
        url,
        site_title: page.title,
        site_summary: parsed.summary,
        platform: data.platform,
      })
      .select("id, url, site_title, site_summary, platform, created_at")
      .single();
    if (genError || !generation) throw new Error(genError?.message ?? "Could not save generation.");

    const { data: savedPosts, error: postError } = await supabase
      .from("posts")
      .insert(
        posts.map((p, index) => ({
          generation_id: generation.id,
          user_id: context.userId,
          position: index,
          content: p.content.trim(),
          hashtags: (p.hashtags ?? []).map((h) => h.replace(/^#/, "")).filter(Boolean),
        })),
      )
      .select("id, position, content, hashtags")
      .order("position");
    if (postError) throw new Error(postError.message);

    return { generation, posts: savedPosts ?? [] };
  });
