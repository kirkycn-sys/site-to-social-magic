import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  content: z.string().min(4).max(2000),
  platform: z.string().min(1).max(40).optional(),
});

const RATIO: Record<string, string> = {
  x: "16:9 landscape",
  linkedin: "1.91:1 landscape",
  instagram: "1:1 square",
  facebook: "1.91:1 landscape",
  tiktok: "9:16 vertical",
};

export const generatePostImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this app.");

    const shape = RATIO[data.platform ?? ""] ?? "1:1 square";

    const prompt = [
      "Create a polished, scroll-stopping social media image that visually illustrates the post below.",
      `Format: ${shape}.`,
      "Style: modern, clean, high quality photography or tasteful graphic illustration.",
      "Do not render any text, letters, words, watermarks or logos in the image.",
      "",
      "POST COPY:",
      data.content,
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{ role: "user", content: prompt }],
        modalities: ["image", "text"],
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) {
        throw new Error("Too many image requests right now — wait a moment and try again.");
      }
      if (res.status === 402) {
        throw new Error("AI credits are exhausted. Add credits in Lovable to keep generating.");
      }
      throw new Error(`Image generation failed (${res.status}). ${detail.slice(0, 160)}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
    const b64 = json.data?.[0]?.b64_json;
    if (!b64) throw new Error("The AI didn't return an image. Try again.");

    return { dataUrl: `data:image/png;base64,${b64}` };
  });
