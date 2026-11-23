import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LucousLogo } from "@/components/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";

/**
 * Split-screen auth layout: form on the left, illustration on the right.
 * The illustration is hidden below the `lg` breakpoint, so phones and small
 * tablets keep the single-column form.
 *
 * The picture column is sized from the viewport height so the whole picture
 * (aspect 776:941 = 0.8247) is visible without being cropped; on very
 * tall/narrow screens it is capped at half the width and trimmed at the
 * sides instead. The width is an inline style on purpose (it does not depend
 * on how Tailwind handles arbitrary values).
 *
 * To use a different picture, replace /public/auth/login-illustration.jpg
 * (keep the same file name; if its aspect ratio differs, update the number
 * in IMAGE_COLUMN_WIDTH below).
 */
const IMAGE_COLUMN_WIDTH = "min(50vw, calc(100dvh * 0.95))";
/** The picture fades into the page background along its left edge. */
const IMAGE_FADE_MASK =
  "linear-gradient(to right, transparent 0%, rgba(0,0,0,0.55) 14%, #000 36%)";

export function AuthSplitLayout({
  children,
  contentClassName = "max-w-lg",
}: {
  children: React.ReactNode;
  /** Width of the form column, e.g. "max-w-2xl" for the wider signup form. */
  contentClassName?: string;
}) {
  return (
    <main className="min-h-dvh bg-background lg:flex dark:bg-[radial-gradient(900px_circle_at_28%_38%,rgba(37,99,235,0.16),transparent_62%),linear-gradient(160deg,#050b1f,#0a1230_55%,#0b1433)]">
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col px-4 py-8 sm:px-10 sm:py-10 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            aria-label="Lucous — home"
            className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <LucousLogo className="text-3xl" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-8">
          <div
            className={`flex w-full flex-col items-center gap-5 ${contentClassName}`}
          >
            {children}
          </div>

          <Link
            href="/auth"
            className="mt-8 inline-flex items-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Change role
          </Link>
        </div>
      </div>

      <div
        className="hidden shrink-0 lg:block"
        style={{ width: IMAGE_COLUMN_WIDTH }}
        aria-hidden
      >
        {/* Inline styles on purpose, so sizing never depends on generated classes. */}
        <div
          style={{
            position: "sticky",
            top: 0,
            width: "100%",
            height: "100dvh",
            overflow: "hidden",
            // Soft fade so the picture blends into the page instead of a hard edge.
            WebkitMaskImage: IMAGE_FADE_MASK,
            maskImage: IMAGE_FADE_MASK,
          }}
        >
          {/* Only visible when the picture file is missing (the <img> below covers it). */}
          <p
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              textAlign: "center",
              fontSize: 12,
              color: "#cbd5e1",
            }}
          >
            Picture not found. Put it at public/auth/login-illustration.jpg
          </p>
          {/* Plain <img> on purpose: loads the file straight from /public. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/auth/login-illustration.jpg"
            alt=""
            draggable={false}
            fetchPriority="high"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "65% center",
            }}
          />
        </div>
      </div>
    </main>
  );
}
