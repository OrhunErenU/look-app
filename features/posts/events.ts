// Bir gönderi oluşturulduğunda veya düzenlendiğinde açık listelerin
// yenilenmesi için basit bir olay kanalı.
type Listener = () => void;
const listeners = new Set<Listener>();

export function onPostsChanged(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyPostsChanged() {
  listeners.forEach((l) => l());
}
