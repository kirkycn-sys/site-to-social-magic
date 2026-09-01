import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clapperboard, ImagePlus, Loader2, Save, Zap } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { AppShell } from "@/components/AppShell";
import { BrandedVideo } from "@/components/BrandedVideo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCreditStatus } from "@/lib/credits.functions";
import {
  VIDEO_BUCKET,
  VIDEO_CREDIT_COST,
  VIDEO_VIBES,
  checkVideo,
  startVideo,
} from "@/lib/video.functions";

export const Route = createFileRoute("/_authenticated/video")({
  head: () => ({
    meta: [
      { title: "Website to short video — SiteToSocial" },
      {
        name: "description",
        content:
          "Turn any website into an 8-second vertical video branded with your logo, company name and phone number.",
      },
      { property: "og:title", content: "Website to short video — SiteToSocial" },
      {
        property: "og:description",
        content: "Paste a URL and get a branded vertical video ready for social.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VideoPage,
});

type VideoRow = {
  id: string;
  url: string;
  headline: string | null;
  status: string;
  error: string | null;
  storage_path: string | null;
  created_at: string;
};

function VideoPage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const runStart = useServerFn(startVideo);
  const runCheck = useServerFn(checkVideo);
  const fetchCredits = useServerFn(getCreditStatus);

  const [url, setUrl] = useState("");
  const [vibe, setVibe] = useState<(typeof VIDEO_VIBES)[number]["id"]>("cinematic");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [accentColor, setAccentColor] = useState("#c8f751");
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const credits = useQuery({ queryKey: ["credit-status"], queryFn: () => fetchCredits() });

  const brand = useQuery({
    queryKey: ["brand-profile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brand_profiles")
        .select("company_name, phone, logo_path, accent_color")
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  useEffect(() => {
    const b = brand.data;
    if (!b) return;
    setCompanyName(b.company_name ?? "");
    setPhone(b.phone ?? "");
    setAccentColor(b.accent_color ?? "#c8f751");
    setLogoPath(b.logo_path ?? null);
  }, [brand.data]);

  useEffect(() => {
    let active = true;
    if (!logoPath) {
      setLogoUrl(null);
      return;
    }
    supabase.storage
      .from("brand-logos")
      .createSignedUrl(logoPath, 3600)
      .then(({ data }) => {
        if (active) setLogoUrl(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [logoPath]);

  const videos = useQuery({
    queryKey: ["videos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("videos")
        .select("id, url, headline, status, error, storage_path, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw new Error(error.message);
      return (data ?? []) as VideoRow[];
    },
  });

  const pending = (videos.data ?? []).filter((v) => v.status === "processing");

  // Poll the gateway for any rendering video until it lands.
  useEffect(() => {
    if (pending.length === 0) return;
    const timer = setInterval(async () => {
      for (const v of pending) {
        try {
          const res = await runCheck({ data: { id: v.id } });
          if (res.status !== "processing") {
            queryClient.invalidateQueries({ queryKey: ["videos"] });
            queryClient.invalidateQueries({ queryKey: ["credit-status"] });
            if (res.status === "failed") toast.error(res.error ?? "Video generation failed.");
            else toast.success("Your video is ready.");
          }
        } catch {
          /* keep polling */
        }
      }
    }, 8000);
    return () => clearInterval(timer);
  }, [pending.map((v) => v.id).join(","), queryClient, runCheck]);

  const saveBrand = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in.");
      const { error } = await supabase.from("brand_profiles").upsert({
        user_id: user.id,
        company_name: companyName.trim() || null,
        phone: phone.trim() || null,
        logo_path: logoPath,
        accent_color: accentColor,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Brand kit saved.");
      queryClient.invalidateQueries({ queryKey: ["brand-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!url.trim()) throw new Error("Add a website link first.");
      return runStart({ data: { url: url.trim(), vibe } });
    },
    onSuccess: () => {
      toast.success("Rendering your video — this takes 1-3 minutes.");
      queryClient.invalidateQueries({ queryKey: ["videos"] });
      queryClient.invalidateQueries({ queryKey: ["credit-status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onLogoChange(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${user.id}/logo.${ext}`;
      const { error } = await supabase.storage
        .from("brand-logos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw new Error(error.message);
      setLogoPath(path);
      toast.success("Logo uploaded — remember to save your brand kit.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const balance = credits.data?.credits ?? 0;

  return (
    <AppShell>
      <h1 className="font-display text-2xl font-bold">Website to short video</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        An 8-second vertical video built from your page content, wrapped in your logo, brand
        colour and phone number. {VIDEO_CREDIT_COST} credits per video.
      </p>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <h2 className="font-display text-base font-semibold">Brand kit</h2>
        <div className="mt-3 space-y-3">
          <div>
            <Label htmlFor="company">Company name</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Roofing"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="phone">Phone number</Label>
            <Input
              id="phone"
              value={phone}
              inputMode="tel"
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 010-2030"
              className="mt-1"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="logo">Logo</Label>
              <label
                htmlFor="logo"
                className="mt-1 flex h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 text-sm text-muted-foreground"
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                {logoPath ? "Replace logo" : "Upload PNG or SVG"}
              </label>
              <input
                id="logo"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onLogoChange(file);
                }}
              />
            </div>
            <div>
              <Label htmlFor="accent">Accent</Label>
              <input
                id="accent"
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="mt-1 h-10 w-14 cursor-pointer rounded-xl border border-border bg-transparent"
              />
            </div>
          </div>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Your uploaded logo"
              className="h-12 w-12 rounded-lg bg-white/90 object-contain p-1"
            />
          ) : null}
          <Button
            variant="secondary"
            className="w-full rounded-xl"
            onClick={() => saveBrand.mutate()}
            disabled={saveBrand.isPending}
          >
            <Save className="size-4" /> Save brand kit
          </Button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-border bg-card p-4">
        <Label htmlFor="url">Website link</Label>
        <Input
          id="url"
          value={url}
          inputMode="url"
          onChange={(e) => setUrl(e.target.value)}
          placeholder="yourcompany.com"
          className="mt-1"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {VIDEO_VIBES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setVibe(v.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                vibe === v.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <Button
          className="mt-4 w-full rounded-xl"
          onClick={() => generate.mutate()}
          disabled={generate.isPending || balance < VIDEO_CREDIT_COST}
        >
          {generate.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Clapperboard className="size-4" />
          )}
          Create video · {VIDEO_CREDIT_COST} credits
        </Button>
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Zap className="size-3.5" />
          {balance} credits available.{" "}
          {balance < VIDEO_CREDIT_COST ? "Top up on the Credits page to make a video." : null}
        </p>
      </section>

      <h2 className="mt-8 font-display text-lg font-semibold">Your videos</h2>
      <div className="mt-3 space-y-4">
        {videos.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (videos.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No videos yet.</p>
        ) : (
          (videos.data ?? []).map((v) => (
            <VideoItem
              key={v.id}
              video={v}
              brand={{ companyName, phone, logoUrl, accentColor }}
            />
          ))
        )}
      </div>
    </AppShell>
  );
}

function VideoItem({
  video,
  brand,
}: {
  video: VideoRow;
  brand: { companyName: string; phone: string; logoUrl: string | null; accentColor: string };
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!video.storage_path) return;
    supabase.storage
      .from(VIDEO_BUCKET)
      .createSignedUrl(video.storage_path, 3600)
      .then(({ data }) => {
        if (active) setSrc(data?.signedUrl ?? null);
      });
    return () => {
      active = false;
    };
  }, [video.storage_path]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3">
      <p className="truncate text-xs text-muted-foreground">{video.url}</p>
      {video.status === "processing" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Rendering — usually 1-3 minutes.
        </p>
      ) : video.status === "failed" ? (
        <p className="mt-3 text-sm text-destructive">
          {video.error ?? "Generation failed — your credits were refunded."}
        </p>
      ) : src ? (
        <div className="mt-3">
          <BrandedVideo
            src={src}
            headline={video.headline}
            brand={{
              companyName: brand.companyName,
              phone: brand.phone,
              logoUrl: brand.logoUrl,
              accentColor: brand.accentColor,
            }}
          />
          <Button asChild variant="secondary" size="sm" className="mt-2 w-full rounded-xl">
            <a href={src} download={`sitetosocial-${video.id}.mp4`}>
              Download MP4
            </a>
          </Button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Loading video…</p>
      )}
    </div>
  );
}
