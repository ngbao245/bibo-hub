import { ABOUT } from './content';

export function About() {
  return (
    <section
      id="about"
      className="border-y border-zinc-900 bg-zinc-950 py-24 [content-visibility:auto] [contain-intrinsic-size:1px_500px] md:py-32"
    >
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          {ABOUT.title}
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-zinc-300 md:text-xl">{ABOUT.body}</p>
      </div>
    </section>
  );
}