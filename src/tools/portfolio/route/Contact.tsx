import { Mail, MessageCircle } from 'lucide-react';
import { CONTACT } from './content';

export function Contact() {
  return (
    <section
      id="contact"
      className="bg-zinc-950 py-24 [content-visibility:auto] [contain-intrinsic-size:1px_500px] md:py-32"
    >
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
          Liên hệ
        </h2>
        <p className="mt-4 text-3xl font-light text-zinc-100 md:text-4xl">{CONTACT.title}</p>
        <p className="mt-6 text-base leading-relaxed text-zinc-400">{CONTACT.description}</p>

        <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <a
            href={CONTACT.zaloLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-zinc-700 bg-zinc-100 px-8 py-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-300"
          >
            <MessageCircle className="h-4 w-4" />
            Nhắn Zalo
          </a>
          <a
            href={CONTACT.emailLink}
            className="inline-flex items-center gap-2 border border-zinc-700 bg-transparent px-8 py-4 text-sm font-medium text-zinc-100 transition-colors hover:border-zinc-500 hover:bg-zinc-900"
          >
            <Mail className="h-4 w-4" />
            Gửi email
          </a>
        </div>
      </div>
    </section>
  );
}