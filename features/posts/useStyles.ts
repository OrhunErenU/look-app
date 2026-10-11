import { useEffect, useState } from 'react';

import { fetchStyles } from '@/features/posts/api';
import type { Style } from '@/types/database';

// Stil listesi nadiren değiştiği için uygulama oturumu boyunca bellekte tutulur.
let cache: Style[] | null = null;

export function useStyles() {
  const [styles, setStyles] = useState<Style[]>(cache ?? []);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache) return;
    fetchStyles()
      .then((data) => {
        cache = data;
        setStyles(data);
      })
      .catch(() => setError(true));
  }, []);

  return { styles, error };
}
