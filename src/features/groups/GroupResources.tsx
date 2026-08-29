import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  createGroupResource,
  getGroupResources,
  deleteGroupResource,
  submitResourceRating,
  incrementResourceCount,
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
  Star,
  Eye,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupResourcesProps {
  groupId: string;
  isMember: boolean;
  userRole?: string;
}

const CATEGORIES = [
  'Notes', 'PYQs', 'Labs', 'Tutorials', 'Books', 'Courses',
  'Projects', 'Research', 'Internships', 'Scholarships', 'Tools', 'Documentation'
];

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
  const [category, setCategory] = useState('Notes');
  const [tagsStr, setTagsStr] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');

  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Rating State
  const [selectedRatingResource, setSelectedRatingResource] = useState<string | null>(null);
  const [selectedStars, setSelectedStars] = useState<number>(5);

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
      const tags = tagsStr.split(',').map((t) => t.trim()).filter(Boolean);
      await createGroupResource(
        groupId,
        title,
        description,
        link,
        type,
        currentUser,
        userProfile,
        {
          category,
          tags,
          difficulty,
        }
      );
      toast.success('Resource shared successfully!');
      setTitle('');
      setDescription('');
      setLink('');
      setTagsStr('');
      setType('link');
      setIsOpen(false);
      loadResources();
    } catch (err: any) {
      toast.error(err.message || 'Failed to share resource.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRating = async (resId: string) => {
    if (!currentUser) return;
    try {
      await submitResourceRating(groupId, resId, selectedStars, currentUser.uid);
      toast.success('Rating review submitted!');
      setSelectedRatingResource(null);
      loadResources();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit rating.');
    }
  };

  const handleAccess = async (res: GroupResource) => {
    if (!res.id) return;
    // Track view count
    incrementResourceCount(groupId, res.id, 'view').catch(() => {});
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
    const matchesCategory = selectedCategoryFilter === 'all' || res.category === selectedCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-sky-400" />
          <span>Campus Knowledge Base</span>
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
            placeholder="Search study materials, notes, PYQs..."
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none shrink-0">
          <button
            onClick={() => setSelectedCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
              selectedCategoryFilter === 'all'
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                : 'bg-slate-950 text-slate-400 border-slate-800'
            }`}
          >
            ALL CATEGORIES
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                selectedCategoryFilter === cat
                  ? 'bg-sky-500/10 text-sky-400 border-sky-500/30'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
            >
              {cat.toUpperCase()}
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
          No resources shared under this category yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredResources.map((res) => {
            const canDelete = isManager || res.createdBy === currentUser?.uid;

            return (
              <div
                key={res.id}
                className="p-4 bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 transition-all relative overflow-hidden"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-slate-950 border border-slate-850 text-sky-400 rounded-full font-mono text-[9px] font-bold uppercase">
                      {res.category || 'Study Material'}
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
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                    {res.description || 'No description provided.'}
                  </p>

                  {/* Subject, difficulty info */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {res.difficulty && (
                      <span className="text-[8px] font-mono px-1.5 py-0.2 bg-slate-950 border border-slate-850 rounded text-amber-400 font-bold uppercase">
                        Difficulty: {res.difficulty}
                      </span>
                    )}
                    {res.semester && (
                      <span className="text-[8px] font-mono px-1.5 py-0.2 bg-slate-950 border border-slate-850 rounded text-slate-400 font-bold">
                        Sem: {res.semester}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {res.tags && res.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {res.tags.map((tag, tIdx) => (
                        <span key={tIdx} className="text-[8px] px-1 bg-slate-950 text-slate-500 rounded font-mono">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ratings & Access buttons */}
                <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-800/60">
                  <div className="flex items-center gap-2 text-[10px] text-slate-550">
                    <button
                      onClick={() => setSelectedRatingResource(res.id || null)}
                      className="flex items-center gap-0.5 text-amber-450 hover:underline"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500/20" />
                      <span>{res.rating || 0} ({res.ratingCount || 0})</span>
                    </button>
                    <span className="flex items-center gap-0.5">
                      <Eye className="w-3 h-3" />
                      <span>{res.viewCount || 0}</span>
                    </span>
                  </div>

                  <a
                    href={res.link}
                    onClick={() => handleAccess(res)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 hover:bg-sky-500 hover:text-slate-950 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 shrink-0"
                  >
                    <span>Open Resource</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Inline rating selector */}
                {selectedRatingResource === res.id && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 space-y-3">
                    <p className="text-[10px] uppercase font-black font-mono text-slate-400">Rate study resource</p>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setSelectedStars(star)}
                          className="p-1 hover:scale-110 transition-transform"
                        >
                          <Star className={`w-5 h-5 ${selectedStars >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRating(res.id!)}
                        className="px-3 py-1 bg-sky-500 text-slate-950 font-bold text-[10px] uppercase rounded-lg"
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => setSelectedRatingResource(null)}
                        className="px-3 py-1 bg-slate-900 text-slate-400 font-bold text-[10px] uppercase rounded-lg"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
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
              <h3 className="text-sm font-black text-white uppercase font-mono flex items-center gap-2">
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

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-none">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">
                  Resource Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. CS101 Lecture Notes week 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-350 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Type</label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-355 focus:outline-none"
                  >
                    <option value="link">Link / URL</option>
                    <option value="note">Note</option>
                    <option value="document">Document Reference</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Resource Link / URL</label>
                <input
                  type="url"
                  required
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://drive.google.com/..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Difficulty Level</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-355 focus:outline-none"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Tags (Comma Separated)</label>
                <input
                  type="text"
                  value={tagsStr}
                  onChange={(e) => setTagsStr(e.target.value)}
                  placeholder="exam, cs101, algorithms"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notes about chapters covered..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none h-16 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2 bg-sky-500 text-slate-950 font-bold text-xs uppercase rounded-xl"
              >
                {submitting ? 'Sharing...' : 'Share Material'}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 bg-slate-950 text-slate-500 font-bold text-xs uppercase rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
