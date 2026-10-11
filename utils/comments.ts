import type { Comment } from '@/types/database';

// Yorumları tek seviyeli yanıt yapısında sıralar: her ana yorumun hemen
// altında yanıtları yer alır. Yanıtların yanıtları da aynı ana yorumun altına
// toplanır. Ana yorumu görünmeyen (ör. engellenen kişiye ait) yanıtlar listede
// kendi başlarına gösterilir.
export function threadComments(comments: Comment[]): { comment: Comment; isReply: boolean }[] {
  const byId = new Map(comments.map((c) => [c.id, c]));
  const rootOf = (c: Comment): string => {
    let current = c;
    const seen = new Set<string>();
    while (current.parent_id && byId.has(current.parent_id) && !seen.has(current.id)) {
      seen.add(current.id);
      current = byId.get(current.parent_id)!;
    }
    return current.id;
  };

  const replies = new Map<string, Comment[]>();
  const roots: Comment[] = [];
  for (const c of comments) {
    const root = rootOf(c);
    if (root === c.id) roots.push(c);
    else replies.set(root, [...(replies.get(root) ?? []), c]);
  }

  const byTime = (a: Comment, b: Comment) => a.created_at.localeCompare(b.created_at);
  return roots.sort(byTime).flatMap((root) => {
    const children = (replies.get(root.id) ?? []).sort(byTime);
    // Silinmiş ve yanıtı olmayan yorumlar gösterilmez.
    if (root.deleted_at && children.length === 0) return [];
    return [
      { comment: root, isReply: false },
      ...children.filter((c) => !c.deleted_at).map((c) => ({ comment: c, isReply: true })),
    ];
  });
}
