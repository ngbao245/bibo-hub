import { useEffect } from 'react';
import { Hero } from './Hero';
import { About } from './About';
import { Services } from './Services';
import { Portfolio } from './Portfolio';
import { Contact } from './Contact';
import { Footer } from './Footer';

// ============================================================
// Landing — public portfolio page tại `/`.
// ============================================================
//
// Dark chrome cứng (không follow user theme) — public landing
// giữ cinematic vibe. Documented trong system.md "Theme & màu"
// mục Ngoại lệ.
// ============================================================

export default function Landing() {
  // Set document title cho tab
  useEffect(() => {
    const prev = document.title;
    document.title = 'Portfolio';
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <Hero />
      <About />
      <Services />
      <Portfolio />
      <Contact />
      <Footer />
    </div>
  );
}