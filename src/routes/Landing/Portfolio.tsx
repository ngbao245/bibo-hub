import { PORTFOLIO } from './content';

export function Portfolio() {
  return (
    <section
      id="portfolio"
      className="border-y border-zinc-900 bg-black py-24 [content-visibility:auto] [contain-intrinsic-size:1px_900px] md:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Portfolio
          </h2>
          <p className="mt-4 text-3xl font-light text-zinc-100 md:text-4xl">
            Một số dự án gần đây
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {PORTFOLIO.map((p) => (
            <article
              key={p.title}
              className="group flex flex-col overflow-hidden border border-zinc-800 bg-zinc-900/40 transition-colors hover:border-zinc-600"
            >
              {/* Image placeholder — gradient block */}
              <div className="aspect-[4/3] w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black" />

              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-lg font-medium text-zinc-100">{p.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">{p.brief}</p>
                <div className="mt-6 flex flex-wrap gap-2">
                  {p.tags.map((t) => (
                    <span
                      key={t}
                      className="border border-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}