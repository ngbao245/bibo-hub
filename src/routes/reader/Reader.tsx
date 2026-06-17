import { useParams } from 'react-router-dom';
import { useBook } from '@/api/reader/books';
import PdfReader from '@/components/reader/PdfReader';
import ReaderSkeleton from '@/components/reader/ReaderSkeleton';

export default function ReaderRoute() {
  const { bookId } = useParams<{ bookId: string }>();
  const bookQuery = useBook(bookId);

  if (bookQuery.isLoading || !bookQuery.data) {
    return (
      <div className="relative h-full bg-zinc-950">
        <ReaderSkeleton />
      </div>
    );
  }

  if (bookQuery.error) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 text-sm text-red-400">
        {bookQuery.error instanceof Error ? bookQuery.error.message : 'Failed to load book'}
      </div>
    );
  }

  return <PdfReader book={bookQuery.data} />;
}