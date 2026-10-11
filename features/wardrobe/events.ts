// Gardırop değiştiğinde açık listelerin yenilenmesi için olay kanalı.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onWardrobeChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyWardrobeChanged() {
  listeners.forEach((l) => l());
}
