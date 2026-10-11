// Koleksiyonlar değiştiğinde açık listelerin yenilenmesi için olay kanalı.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onCollectionsChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyCollectionsChanged() {
  listeners.forEach((l) => l());
}
