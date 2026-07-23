import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// ============================================================
// Tailwind config - shadcn/ui style vß╗¢i theme dark + vu├┤ng vß╗⌐c
// ============================================================
//
// Theme d├╣ng CSS variables (─æß╗ïnh ngh─⌐a trong index.css) ΓÇö chuß║⌐n shadcn,
// dß╗à thay theme runtime nß║┐u sau n├áy muß╗æn light mode.
//
// borderRadius giß╗» 0 tuyß╗çt ─æß╗æi ΓÇö shadcn components vß║½n render OK.
// ============================================================

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    // Override ho├án to├án: chß╗ë cho ph├⌐p radius = 0
    // Exception: `full` giß╗» = 9999px cho avatar tr├▓n (avatar l├á data element,
    // kh├┤ng phß║úi chrome UI ΓÇö theme "vu├┤ng vß╗⌐c" kh├┤ng ├íp dß╗Ñng).
    borderRadius: {
      none: '0',
      DEFAULT: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      full: '9999px',
    },
    extend: {
      colors: {
        // shadcn semantic tokens (─æß╗ìc tß╗½ CSS vars)
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },

        // Legacy tokens (giß╗» t╞░╞íng th├¡ch vß╗¢i code ─æ├ú viß║┐t)
        bg: {
          primary: 'hsl(var(--background))',
          secondary: 'hsl(var(--card))',
          elevated: 'hsl(var(--popover))',
          hover: 'hsl(var(--muted))',
        },
        text: {
          primary: 'hsl(var(--foreground))',
          secondary: 'hsl(var(--secondary-foreground))',
          muted: 'hsl(var(--muted-foreground))',
        },
        danger: {
          DEFAULT: 'hsl(var(--destructive))',
          hover: 'hsl(var(--destructive))',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['Consolas', 'Courier New', 'monospace'],
      },
      transitionDuration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: { height: '0' },
        },
        indeterminate: {
          '0%': {
            transform: 'translateX(-100%)',
          },
          '100%': {
            transform: 'translateX(400%)',
          },
        },
        // Beam ├ính s├íng chß║íy 1 lß║ºn tß╗½ tr├íi qua phß║úi container.
        // ─Éß║╖t overlay ß╗ƒ container level (KH├öNG phß║úi per-block) ─æß╗â 1 dß║úi s├íng
        // duy nhß║Ñt tr├┤i qua nhiß╗üu block c├╣ng l├║c, kh├┤ng c├│ cß║úm gi├íc flash
        // per-block. Container cß║ºn: `relative overflow-hidden`. Overlay cß║ºn
        // width = 40-50% container, d├╣ng translate ─æß╗â chß║íy tß╗½ -100% ΓåÆ 200%.
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(300%)' },
          // nghiêng 45 độ
          // '0%': { transform: 'translateX(-100%) skewX(-45deg)' },
          // '100%': { transform: 'translateX(300%) skewX(-45deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        indeterminate:
          'indeterminate 1.5s infinite ease-in-out',
        shimmer: 'shimmer 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config;