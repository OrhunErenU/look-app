import type { Comment } from '@/types/database';
import { threadComments } from '@/utils/comments';
import { friendlyError } from '@/utils/errors';
import { compactCount, timeAgo } from '@/utils/format';
import { centerCrop, displayAspect, fitWithin } from '@/utils/image';

describe('görsel hesapları', () => {
  it('orijinal oranda kırpma yapmaz', () => {
    expect(centerCrop(1080, 1920, 'original')).toBeNull();
  });

  it('dikey fotoğrafı 4:5 için ortadan keser', () => {
    expect(centerCrop(1080, 1920, '4:5')).toEqual({ originX: 0, originY: 285, width: 1080, height: 1350 });
  });

  it('dikey fotoğrafı 3:4 için ortadan keser', () => {
    expect(centerCrop(1080, 1920, '3:4')).toEqual({ originX: 0, originY: 240, width: 1080, height: 1440 });
  });

  it('yatay fotoğrafı 1:1 için ortadan keser', () => {
    expect(centerCrop(2000, 1000, '1:1')).toEqual({ originX: 500, originY: 0, width: 1000, height: 1000 });
  });

  it('zaten doğru orandaki fotoğrafa dokunmaz', () => {
    expect(centerCrop(1000, 1000, '1:1')).toBeNull();
  });

  it('uzun kenarı sınırlar, küçük görseli büyütmez', () => {
    expect(fitWithin(3000, 4000, 1440)).toEqual({ width: 1080, height: 1440 });
    expect(fitWithin(800, 600, 1440)).toEqual({ width: 800, height: 600 });
  });

  it('akıştaki görüntü oranını sınırlar', () => {
    expect(displayAspect(1080, 3000)).toBeCloseTo(0.75);
    expect(displayAspect(4000, 1000)).toBeCloseTo(1.91);
    expect(displayAspect(1000, 1000)).toBe(1);
  });
});

describe('biçimlendirme', () => {
  const now = new Date('2026-10-11T12:00:00Z');

  it('göreli zamanı Türkçe gösterir', () => {
    expect(timeAgo('2026-10-11T11:59:30Z', now)).toBe('şimdi');
    expect(timeAgo('2026-10-11T11:15:00Z', now)).toBe('45 dk');
    expect(timeAgo('2026-10-11T07:00:00Z', now)).toBe('5 sa');
    expect(timeAgo('2026-10-08T12:00:00Z', now)).toBe('3 g');
    expect(timeAgo('2026-09-27T12:00:00Z', now)).toBe('2 hf');
  });

  it('sayıları kısaltır', () => {
    expect(compactCount(999)).toBe('999');
    expect(compactCount(1200)).toBe('1,2 B');
    expect(compactCount(1000)).toBe('1 B');
    expect(compactCount(25_000)).toBe('25 B');
    expect(compactCount(3_400_000)).toBe('3,4 Mn');
  });
});

describe('hata mesajları', () => {
  it('ağ hatalarını anlaşılır gösterir', () => {
    expect(friendlyError(new TypeError('Network request failed'))).toMatch(/İnternet/);
  });

  it('veritabanı fonksiyonlarının Türkçe mesajlarını korur', () => {
    expect(friendlyError({ code: 'P0429', message: 'Çok hızlı yorum yapıyorsun.' })).toBe('Çok hızlı yorum yapıyorsun.');
  });

  it('teknik ayrıntıları kullanıcıya göstermez', () => {
    expect(friendlyError({ code: 'XX000', message: 'internal relation error' })).toBe('Bir şeyler ters gitti. Tekrar dene.');
    expect(friendlyError({ code: '23505', message: 'duplicate key profiles_username_key' })).toBe('Bu kullanıcı adı alınmış.');
  });
});

describe('yorum dizilimi', () => {
  const base = { post_id: 'p', user_id: 'u', updated_at: '', deleted_at: null, author: null };
  const c = (id: string, created_at: string, parent_id: string | null = null, deleted = false): Comment => ({
    ...base,
    id,
    body: id,
    created_at,
    parent_id,
    deleted_at: deleted ? created_at : null,
  });

  it('yanıtları ana yorumun altına sıralar', () => {
    const result = threadComments([
      c('b', '2026-01-02'),
      c('a1', '2026-01-03', 'a'),
      c('a', '2026-01-01'),
      c('a1x', '2026-01-04', 'a1'),
    ]);
    expect(result.map((r) => [r.comment.id, r.isReply])).toEqual([
      ['a', false],
      ['a1', true],
      ['a1x', true],
      ['b', false],
    ]);
  });

  it('yanıtı olmayan silinmiş yorumları gizler, yanıtı olanı korur', () => {
    const result = threadComments([
      c('a', '2026-01-01', null, true),
      c('b', '2026-01-02', null, true),
      c('b1', '2026-01-03', 'b'),
    ]);
    expect(result.map((r) => r.comment.id)).toEqual(['b', 'b1']);
  });

  it('ana yorumu görünmeyen yanıtı tek başına gösterir', () => {
    const result = threadComments([c('x1', '2026-01-01', 'gizli')]);
    expect(result).toEqual([{ comment: expect.objectContaining({ id: 'x1' }), isReply: false }]);
  });
});
