import { useEffect } from 'react';

// Parça seçme ekranı ile onu açan ekran (paylaşım veya kombin düzenleme)
// arasındaki seçim. Ekranlar arasında parametre olarak uzun listeler
// taşımamak için küçük bellek içi bir kanal kullanılır. Seçim yalnızca seçiciyi
// açan ekrana iletilir; aynı anda açık başka bir ekranın verisi değişmez.
type Listener = (ids: string[]) => void;

let current: string[] = [];
let currentTarget: string | null = null;
const listeners = new Map<string, Set<Listener>>();

export function startPicking(target: string, initial: string[]) {
  currentTarget = target;
  current = initial;
}

export function getPickedItems() {
  return current;
}

export function finishPicking(ids: string[]) {
  current = ids;
  if (currentTarget) listeners.get(currentTarget)?.forEach((l) => l(ids));
  currentTarget = null;
}

export function usePickedItemsListener(target: string, onChange: Listener) {
  useEffect(() => {
    const set = listeners.get(target) ?? new Set<Listener>();
    set.add(onChange);
    listeners.set(target, set);
    return () => {
      set.delete(onChange);
    };
  }, [target, onChange]);
}
