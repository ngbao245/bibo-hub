import { ArrowRight } from 'lucide-react';
import { SERVICES } from './content';

export function Services() {
  const scrollToContact = () => {
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section
      id="services"
      className="bg-zinc-950 py-24 [content-visibility:auto] [contain-intrinsic-size:1px_800px] md:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Dịch vụ
          </h2>
          <p className="mt-4 text-3xl font-light text-zinc-100 md:text-4xl">
            Các dịch vụ tôi cung cấp
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.title}
                className="group flex flex-col border border-zinc-800 bg-zinc-900/40 p-8 transition-colors hover:border-zinc-600"
              >
                <Icon className="h-8 w-8 text-zinc-400 transition-colors group-hover:text-zinc-100" />
                <h3 className="mt-6 text-xl font-medium text-zinc-100">{s.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">
                  {s.description}
                </p>
                <button
                  onClick={scrollToContact}
                  className="mt-8 inline-flex items-center gap-2 self-start text-sm font-medium text-zinc-300 transition-colors hover:text-zinc-100"
                >
                  Liên hệ
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}