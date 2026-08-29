import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  createGroupResource,
  getGroupResources,
  deleteGroupResource,
  type GroupResource,
} from '../../services/groupResourceService';
import {
  Trash2,
  Plus,
  RefreshCw,
  X,
  ExternalLink,
  BookOpen,
  Search,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupResourcesProps {
  groupId: string;
  isMember: boolean;
  userRole?: string;
}

export const GroupResources: React.FC<GroupResourcesProps> = ({
  groupId,
  isMember,
  userRole,
}) => {
  const { currentUser, userProfile } = useAuth();
  const [resources, setResources] = useState<GroupResource[]>([]);
  const [loading, setLoading] = useState(true);

  // Creation Form State
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [link, setLink] = useState('');
  const [type, setType] = useState<GroupResource['type']>('link');
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  const loadResources = async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const list = await getGroupResources(groupId);
      setResources(list);
    } catch (err) {
      console.error('Failed to load group resources:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadResources();
  }, [groupId]);

  const handleCreateResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !link.trim() || submitting || !currentUser) return;

    setSubmitting(true);
    try {
      await createGroupResource(
        groupId,
        title,
        description,
        link,
        type,
        currentUser,
        userProfile
      );
      toast.success('Resource shared successfully!');
      setTitle('');
      setDescription('');
      setLink('');
      setType('link');
      setIsOpen(false);
      loadResources();
    } catch (err: any) {
      toast.error(err.message || 'Failed to share resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (resId: string) => {
    if (!window.confirm('Are you sure you want to remove this resource?')) return;
    try {
      await deleteGroupResource(groupId, resId);
      toast.success('Resource removed.');
      setResources((prev) => prev.filter((r) => r.id !== resId));
    } catch {
      toast.error('Failed to remove resource.');
    }
  };

  const isManager = userRole === 'owner' || userRole === 'admin' || userRole === 'moderator';

  const filteredResources = resources.filter((res) => {
    const matchesSearch = !searchQuery || res.title.toLowerCase().includes(searchQuery.toLowerCase()) || (res.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'all' || res.type === selectedType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span>Shared Group Resources</span>
        </h3>

        {isMember && (
          <button
            onClick={() => setIsOpen(true)}
            className="px-3.5 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Resource</span>
          </button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search resources by title or content..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
          {['all', 'link', 'note', 'document', 'other'].map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedType === t
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Resource Cards Grid */}
      {loading ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
          <span>Loading resources...</span>
        </div>
      ) : filteredResources.length === 0 ? (
        <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center text-xs text-slate-400 italic">
          No matching resources found in this group.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredResources.map((res) => {
            const canDelete = isManager || res.createdBy === currentUser?.uid;

            return (
              <div
                key={res.id}
                className="p-4 bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 transition-all"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 text-slate-400 rounded-full font-mono text-[9px] font-bold uppercase">
                      {res.type}
                    </span>

                    {canDelete && (
                      <button
                        onClick={() => handleDelete(res.id!)}
                        className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-rose-400 transition-colors"
                        title="Remove Resource"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-white line-clamp-1">{res.title}</h4>
                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {res.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono">By: {res.creatorName}</span>

                  <a
                    href={res.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500 hover:text-slate-950 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 shrink-0"
                  >
                    <span>Open Resource</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <form
            onSubmit={handleCreateResource}
            className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-sky-400" />
                <span>Share Group Resource</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">
                  Resource Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Study Guide - Midterm Prep"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">
                  Description / Notes
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain what this resource contains..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-sky-500/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">
                    Resource Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as GroupResource['type'])}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500/50"
                  >
                    <option value="link">External Link</option>
                    <option value="note">Shared Note</option>
                    <option value="document">Document Link</option>
                    <option value="other">Other Material</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase font-mono block mb-1">
                    URL Link
                  </label>
                  <input
                    type="url"
                    required
                    value={link}
                    onChange={(e) => setLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:border-sky-500/50"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-xl text-xs font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
              <span>Share Resource</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
