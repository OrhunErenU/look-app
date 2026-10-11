// Görsel boyut hesapları. Saf fonksiyonlardır; test edilebilir.

// Dikey kombin fotoğraflarında 3:4 ana orandır.
export type AspectOption = 'original' | '3:4' | '4:5' | '1:1';

export const ASPECT_LABELS: Record<AspectOption, string> = {
  original: 'Orijinal',
  '3:4': '3:4',
  '4:5': '4:5',
  '1:1': '1:1',
};

const RATIOS: Record<Exclude<AspectOption, 'original'>, number> = {
  '3:4': 3 / 4,
  '4:5': 4 / 5,
  '1:1': 1,
};

// Fotoğrafın ortasından istenen oranda en büyük alanı keser.
export function centerCrop(
  width: number,
  height: number,
  aspect: AspectOption,
): { originX: number; originY: number; width: number; height: number } | null {
  if (aspect === 'original') return null;
  const target = RATIOS[aspect];
  const current = width / height;
  if (Math.abs(current - target) < 0.01) return null;
  if (current > target) {
    const cropWidth = Math.round(height * target);
    return { originX: Math.round((width - cropWidth) / 2), originY: 0, width: cropWidth, height };
  }
  const cropHeight = Math.round(width / target);
  return { originX: 0, originY: Math.round((height - cropHeight) / 2), width, height: cropHeight };
}

// Uzun kenarı sınırlayarak yeniden boyutlandırma ölçüsü verir; küçük
// görseller büyütülmez.
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Akışta çok uzun veya çok geniş fotoğraflar ekranı kaplamasın diye oran
// sınırlandırılır; fotoğraf kırpılmaz, kenarlarda boşluk kalır.
export function displayAspect(width: number, height: number): number {
  const ratio = width / height;
  return Math.min(Math.max(ratio, 3 / 4), 1.91);
}
