// ============================================================
// BookmarkHeader — Hero block above bookmark grid
// ============================================================
// Chỉ hiện khi showHero = true. Render Superdense-style hero:
//   h1 displayName + space link + public URL below.
//
// Owner route + public route đều dùng. Owner status bar (Public badge / URL
// pill / Preview link) render riêng qua BookmarkStatusBar (always visible for
// owner, not exposed to public visitor).
// ============================================================

interface Props {
  showHero: boolean;
  displayName: string;
  spaceName: string;
  publicUrl: string;
  webpage?: string;
}

export function BookmarkHeader({
  showHero,
  displayName,
  spaceName,
  publicUrl,
  webpage,
}: Props) {
  if (!showHero) return null;
  // Chỉ hiện URL nếu user đã điền webpage. Không fallback publicUrl.
  const heroUrl = webpage?.trim() || null;
  const displayUrl = heroUrl ? heroUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : null;

  return (
    <div className="col dense flex flex-col items-start gap-0 text-left">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="bibo-hero-title text-3xl font-bold leading-tight tracking-tight text-foreground md:text-4xl">
          {displayName}
        </h1>
        {spaceName && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="spaces-link text-base font-medium text-muted-foreground hover:text-primary"
          >
            {spaceName}
          </a>
        )}
      </div>
      {heroUrl && displayUrl && (
        <a
          href={heroUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="user-static-link mt-1 text-xs text-muted-foreground/60 hover:text-primary"
        >
          {displayUrl}
        </a>
      )}
    </div>
  );
}
