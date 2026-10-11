import { useCallback, useEffect, useRef, useState } from 'react';

import { friendlyError } from '@/utils/errors';

// Sayfalı listeler için ortak durum yönetimi: ilk yükleme, yenileme,
// sonraki sayfa ve hata durumu. `fetchPage` önceki öğeleri alır ve sonraki
// sayfayı döndürür; boş sayfa listenin bittiğini gösterir.
export function usePagedList<T extends { id: string }>(
  fetchPage: (previous: T[]) => Promise<T[]>,
  deps: unknown[],
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const itemsRef = useRef<T[]>([]);
  itemsRef.current = items;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fetcher = useCallback(fetchPage, deps);

  const load = useCallback(
    async (mode: 'initial' | 'refresh') => {
      const id = ++requestId.current;
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const page = await fetcher([]);
        if (id !== requestId.current) return;
        setItems(page);
        setDone(page.length === 0);
        setError(null);
      } catch (e) {
        if (id === requestId.current) setError(friendlyError(e));
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [fetcher],
  );

  useEffect(() => {
    setItems([]);
    setDone(false);
    load('initial');
  }, [load]);

  const loadMore = useCallback(async () => {
    if (loading || loadingMore || done || itemsRef.current.length === 0) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const page = await fetcher(itemsRef.current);
      if (id !== requestId.current) return;
      // Aynı içerik sayfalar arasında tekrar etmesin.
      const seen = new Set(itemsRef.current.map((i) => i.id));
      const fresh = page.filter((i) => !seen.has(i.id));
      setItems((prev) => [...prev, ...fresh]);
      if (fresh.length === 0) setDone(true);
    } catch {
      // Sonraki sayfa hatası listeyi bozmaz; kullanıcı kaydırınca yeniden denenir.
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, done, fetcher]);

  const refresh = useCallback(() => load('refresh'), [load]);
  const retry = useCallback(() => load('initial'), [load]);

  return {
    items,
    setItems,
    loading,
    refreshing,
    loadingMore,
    error,
    refresh,
    retry,
    loadMore,
  };
}
