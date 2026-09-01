import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export type GeneratedPost = {
  id?: string;
  position?: number;
  content: string;
  hashtags: string[];
};

export function PostCard({ post, index }: { post: GeneratedPost; index: number }) {
  const [copied, setCopied] = useState(false);

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
    </article>
  );
}
