import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

// ============================================================
// Tailwind config - shadcn/ui style với theme dark + vuông vức
// ============================================================
//
// Theme dùng CSS variables (định nghĩa trong index.css) — chuẩn shadcn,
// dễ thay theme runtime nếu sau này muốn light mode.
//
// borderRadius giữ 0 tuyệt đối — shadcn components vẫn render OK.
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
    // Override hoàn toàn: chỉ cho phép radius = 0
    borderRadius: {
      none: '0',
      DEFAULT: '0',
      sm: '0',
      md: '0',
      lg: '0',
      xl: '0',
      full: '0',
    },
    extend: {
      colors: {
        // shadcn semantic tokens (đọc từ CSS vars)
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

        // Legacy tokens (giữ tương thích với code đã viết)
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
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
} satisfies Config;
