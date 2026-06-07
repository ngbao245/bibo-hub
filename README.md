# HubiBo Tools

All-in-one productivity toolkit với notes, tasks, calculator, file transfer và nhiều tools khác.

## Tech Stack

- **Vite** + **React 18** + **TypeScript**
- **Tailwind CSS** - Design system với shadcn/ui
- **React Router v6** - SPA routing
- **TanStack Query v5** - Data fetching & caching
- **Zustand** - Global state management
- **Zod** - Runtime type validation

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Features

### Core Tools
- 📝 **Notes** - Rich text editor với linking và search
- ✅ **Tasks** - Task management với filters và priority
- 🎬 **Movies** - Movie tracking với rating
- 💰 **Expense** - Expense tracking với categories
- 📦 **Project Packer** - Serialize project sang plain text để share qua chat

### Utilities
- 🧮 **Calculator** - Quick calculator modal
- 🌐 **Translator** - Multi-language translation
- 🔐 **Secret** - Encrypt/decrypt messages
- 💾 **Backup** - Export/import data
- 📊 **Savings** - Savings goal tracker
- 🔑 **Encoder** - Base64, URL encoding tools

## Project Structure

```
src/
├── routes/          # Pages (Notes, Tasks, Movies, Expense...)
├── components/      # Reusable UI components
├── modals/          # Tool modals (Calculator, Translate...)
├── api/             # TanStack Query hooks
├── lib/             # Utilities (packer, crypto, parsers...)
├── hooks/           # Custom React hooks
├── stores/          # Zustand stores
└── styles/          # Global CSS & Tailwind config
```

## Documentation

- [Project Packer Format](./docs/project-packer.md) - Spec cho serialization format
- [Architecture](./docs/architecture.md) - System design overview
- [Migration Log](./docs/migration-log.md) - History từ vanilla JS sang React

## Deployment

Project được deploy trên Vercel:
- **Standalone**: https://note-silk-gamma.vercel.app
- **Via proxy**: https://vudecor.vn/hubibo (ăn ké domain)

Config cho proxy deployment:
```json
{
  "rewrites": [
    {"source": "/hubibo", "destination": "https://note-silk-gamma.vercel.app/"},
    {"source": "/hubibo/:match*", "destination": "https://note-silk-gamma.vercel.app/:match*"}
  ]
}
```

## License

MIT
