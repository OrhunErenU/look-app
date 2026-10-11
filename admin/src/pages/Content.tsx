import { useState } from 'react';

import { useStaff } from '../auth';
import { ActionButton, ErrorText, Loading, PostThumbs, StatusBadge } from '../components';
import { formatDate, supabase } from '../lib/supabase';
import { unwrap, useAsync } from '../lib/useAsync';

type Post = {
  id: string;
  title: string;
  caption: string;
  visibility: string;
  moderation_status: string;
  featured_at: string | null;
  is_sample: boolean;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: { username: string } | null;
  images: { thumb_path: string; position: number }[];
};

// İçerik inceleme ve keşfet için öne çıkarma. Örnek içerikler uygulamada
// “LOOK örnek kombin” olarak etiketlenir.
export function Content() {
  const { level } = useStaff();
  const [filter, setFilter] = useState('all');

  const { data, error, loading, reload } = useAsync(async () => {
    let query = supabase
      .from('posts')
      .select(
        'id, title, caption, visibility, moderation_status, featured_at, is_sample, like_count, comment_count, created_at, author:profiles(username), images:post_images(thumb_path, position)',
      )
      .order('created_at', { ascending: false })
      .limit(60);
    if (filter === 'featured') query = query.not('featured_at', 'is', null);
    else if (filter === 'sample') query = query.eq('is_sample', true);
    else if (filter !== 'all') query = query.eq('moderation_status', filter);
    return unwrap<Post[]>(query as never);
  }, [filter]);

  const setStatus = async (post: Post, status: string) => {
    await unwrap(supabase.rpc('admin_set_post_status', { p_post_id: post.id, p_status: status }));
    reload();
  };

  const setFlags = async (post: Post, featured: boolean, sample: boolean) => {
    await unwrap(supabase.rpc('admin_set_post_flags', { p_post_id: post.id, p_featured: featured, p_sample: sample }));
    reload();
  };

  return (
    <>
      <h1>İçerik</h1>
      <div className="toolbar">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Tüm kombinler</option>
          <option value="active">Yayında</option>
          <option value="under_review">İncelemede</option>
          <option value="removed">Kaldırılan</option>
          <option value="featured">Öne çıkanlar</option>
          <option value="sample">Örnek içerikler</option>
        </select>
        <button className="secondary" onClick={reload}>
          Yenile
        </button>
      </div>
      {error ? <ErrorText message={error} onRetry={reload} /> : null}
      {loading && !data ? <Loading /> : null}
      {data?.length === 0 ? <p className="muted">Kayıt yok.</p> : null}
      <div className="cards">
        {data?.map((post) => (
          <div className="card" key={post.id} style={{ display: 'grid', gap: 8 }}>
            <PostThumbs paths={[...post.images].sort((a, b) => a.position - b.position).slice(0, 1).map((i) => i.thumb_path)} />
            <strong>{post.title || 'Başlıksız kombin'}</strong>
            <div className="muted small">
              @{post.author?.username ?? '-'} · {formatDate(post.created_at)}
            </div>
            <div className="row small">
              <StatusBadge value={post.moderation_status} />
              <StatusBadge value={post.visibility} />
              {post.featured_at ? <span className="badge olive">Öne çıkan</span> : null}
              {post.is_sample ? <span className="badge">Örnek</span> : null}
            </div>
            <div className="muted small">
              {post.like_count} beğeni · {post.comment_count} yorum
            </div>
            <div className="actions">
              {level >= 2 ? (
                post.moderation_status === 'removed' ? (
                  <ActionButton variant="secondary" onRun={() => setStatus(post, 'active')}>
                    Geri yükle
                  </ActionButton>
                ) : (
                  <ActionButton variant="danger" confirm="Kombin kaldırılsın mı?" onRun={() => setStatus(post, 'removed')}>
                    Kaldır
                  </ActionButton>
                )
              ) : null}
              {level >= 3 && post.visibility === 'public' && post.moderation_status === 'active' ? (
                <>
                  <ActionButton variant="secondary" onRun={() => setFlags(post, !post.featured_at, post.is_sample)}>
                    {post.featured_at ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                  </ActionButton>
                  <ActionButton variant="secondary" onRun={() => setFlags(post, Boolean(post.featured_at), !post.is_sample)}>
                    {post.is_sample ? 'Örnek etiketini kaldır' : 'Örnek olarak işaretle'}
                  </ActionButton>
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
