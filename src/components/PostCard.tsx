import { useState } from "react";
import { Check, Copy, Download, ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { generatePostImage } from "@/lib/post-image.functions";

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
  const makeImage = useServerFn(generatePostImage);

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

  const createImage = async () => {
    setBusy(true);
    try {
      const result = await makeImage({ data: { content: post.content, platform } });
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
        {image && (
          <a
            href={image}
            download={`sitetosocial-post-${index + 1}.png`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Download className="size-3.5" /> Download
          </a>
        )}
      </div>
    </article>
  );
}
