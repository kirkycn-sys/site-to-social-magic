import { useRef, useState } from "react";
import { Check, Copy, Download, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generatePostImage, IMAGE_STYLES, type ImageStyleId } from "@/lib/post-image.functions";

export type GeneratedPost = {
  id?: string;
  position?: number;
  content: string;
  hashtags: string[];
};

export function PostCard({
  post,
  index,
  platform,
}: {
  post: GeneratedPost;
  index: number;
  platform?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [style, setStyle] = useState<ImageStyleId>("photo");
  const [description, setDescription] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const makeImage = useServerFn(generatePostImage);

  const onPickFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("That image is larger than 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
      toast.success("Image added");
    };
    reader.onerror = () => toast.error("Couldn't read that image");
    reader.readAsDataURL(file);
  };

  const fullText = [post.content, post.hashtags.map((h) => `#${h}`).join(" ")]
    .filter(Boolean)
    .join("\n\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      toast.success("Post copied");
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error("Copy failed — select the text manually");
    }
  };

  const downloadCombined = async () => {
    if (!image) return;
    const img = new Image();
    img.src = image;
    await img.decode();

    const width = 1080;
    const scale = width / img.naturalWidth;
    const imgHeight = Math.round(img.naturalHeight * scale);
    const pad = 56;
    const bodySize = 34;
    const lineHeight = Math.round(bodySize * 1.45);

    const measure = document.createElement("canvas").getContext("2d")!;
    measure.font = `500 ${bodySize}px "DM Sans", system-ui, sans-serif`;

    const wrap = (text: string, maxWidth: number) => {
      const lines: string[] = [];
      for (const para of text.split("\n")) {
        if (!para.trim()) {
          lines.push("");
          continue;
        }
        let line = "";
        for (const word of para.split(/\s+/)) {
          const next = line ? `${line} ${word}` : word;
          if (measure.measureText(next).width > maxWidth && line) {
            lines.push(line);
            line = word;
          } else {
            line = next;
          }
        }
        lines.push(line);
      }
      return lines;
    };

    const maxWidth = width - pad * 2;
    const bodyLines = wrap(post.content, maxWidth);
    const tagLines = post.hashtags.length
      ? wrap(post.hashtags.map((h) => `#${h}`).join(" "), maxWidth)
      : [];

    const textBlock =
      pad + bodyLines.length * lineHeight + (tagLines.length ? 16 + tagLines.length * lineHeight : 0) + pad;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = imgHeight + textBlock;
    const ctx = canvas.getContext("2d")!;

    ctx.fillStyle = "#12141a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, width, imgHeight);

    let y = imgHeight + pad + bodySize;
    ctx.font = `500 ${bodySize}px "DM Sans", system-ui, sans-serif`;
    ctx.fillStyle = "#f4f5f7";
    for (const line of bodyLines) {
      ctx.fillText(line, pad, y);
      y += lineHeight;
    }
    if (tagLines.length) {
      y += 16;
      ctx.fillStyle = "#8fe388";
      for (const line of tagLines) {
        ctx.fillText(line, pad, y);
        y += lineHeight;
      }
    }

    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `sitetosocial-post-${index + 1}.png`;
    link.click();
  };

  const createImage = async () => {
    setBusy(true);
    try {
      const result = await makeImage({
        data: {
          content: post.content,
          platform,
          style,
          ...(description.trim() && { description: description.trim() }),
        },
      });
      setImage(result.dataUrl);
    } catch (error) {
      toast.error((error as Error).message || "Couldn't create the image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-2xl border border-border bg-card p-4 shadow-panel">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded-full bg-secondary px-2.5 py-1 font-display text-xs font-semibold text-muted-foreground">
          {String(index + 1).padStart(2, "0")}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={copy}
          className="h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-card-foreground">
        {post.content}
      </p>
      {post.hashtags.length > 0 && (
        <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-accent">
          {post.hashtags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </p>
      )}

      {image && (
        <img
          src={image}
          alt={`Visual for post ${index + 1}`}
          className="mt-3 w-full rounded-xl border border-border object-cover"
        />
      )}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {IMAGE_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className={
              s.id === style
                ? "rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground"
                : "rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
            }
          >
            {s.label}
          </button>
        ))}
      </div>
      <Input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Optional: what should the photo show?"
        maxLength={200}
        className="mt-2 h-9 rounded-xl border-border bg-surface text-sm"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={createImage}
          disabled={busy}
          className="h-8 gap-1.5 px-2.5 text-xs"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <ImageIcon className="size-3.5" />}
          {busy ? "Creating image…" : image ? "New image" : "Create image"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInput.current?.click()}
          className="h-8 gap-1.5 px-2.5 text-xs"
        >
          <Upload className="size-3.5" /> Use my image
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          className="hidden"
        />
        {image && (
          <>
            <Button
              size="sm"
              variant="ghost"
              onClick={downloadCombined}
              className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <Download className="size-3.5" /> Download post
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setImage(null)}
              className="h-8 gap-1.5 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" /> Remove
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
