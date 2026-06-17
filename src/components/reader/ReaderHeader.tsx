import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function ReaderHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <Link to="/reader" className="text-zinc-400 hover:text-zinc-100">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <span className="truncate text-sm text-zinc-200">{title}</span>
      </div>
      <div className="flex items-center gap-1">{children}</div>
    </header>
  );
}