import { useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useBook, useIncrementViewCount } from '@/api/library/books';
import PdfReader from '@/components/library/PdfReader';
import ReaderSkeleton from '@/components/library/ReaderSkeleton';

export default function ReaderRoute() {
  const { bookId } = useParams<{ bookId: string }>();
  const bookQuery = useBook(bookId);
  const [searchParams] = useSearchParams();
  const incrementView = useIncrementViewCount();
  const incrementedRef = useRef(false);

  // Increment view count once per mount (fire-and-forget).
  useEffect(() => {
    if (bookId && !incrementedRef.current) {
      incrementedRef.current = true;
      incrementView.mutate(bookId);
    }
  }, [bookId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deep-link từ RAG citation [p.X] click → /library/:id?page=X
  const pageParam = searchParams.get('page');
  const initialPage = pageParam ? Number(pageParam) : undefined;
  const validInitialPage =
    initialPage !== undefined && Number.isFinite(initialPage) && initialPage >= 1
      ? Math.floor(initialPage)
      : undefined;

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

  return <PdfReader book={bookQuery.data} initialPage={validInitialPage} />;
}