import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import type { Post } from '../../types';
import { PostCard } from '../feed/PostCard';
import { CreatePostModal } from '../feed/CreatePostModal';
import { RefreshCw, FileText, Plus } from 'lucide-react';

interface GroupPostsProps {
  groupId: string;
  isMember: boolean;
}

export const GroupPosts: React.FC<GroupPostsProps> = ({ groupId, isMember }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!groupId) return;
    setLoading(true);

    const postsRef = collection(db, 'posts');
    const q = query(
      postsRef,
      where('groupId', '==', groupId),
      where('status', '==', 'active'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Post),
      }));
      setPosts(list);
      setLoading(false);
    }, (err) => {
      console.error('Failed to load group posts:', err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [groupId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Group Discussions & Posts</span>
        </h3>

        {isMember && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Post</span>
          </button>
        )}
      </div>

      {loading ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Loading group posts...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
          No posts in this group yet. Be the first to start a conversation!
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <CreatePostModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        groupId={groupId}
        onPostCreated={() => {}}
      />
    </div>
  );
};
