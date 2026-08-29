import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackButton } from '../../components/BackButton';
import {
  getSubjectNotes,
  addStudyNote,
  getSubjectQuestions,
  askDoubtQuestion,
  upvoteQuestion,
  type StudyNote,
  type DoubtQuestion,
  getSubjectsList,
  getNoteVersions,
  addNoteVersion,
  type NoteVersion
} from '../../services/academicService';
import {
  BookOpen,
  Plus,
  Award,
  ThumbsUp,
  MessageSquare,
  ExternalLink,
  GitBranch,
  History,
  RefreshCw,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';

export const SubjectPage: React.FC = () => {
  const { subjectId } = useParams<{ subjectId: string }>();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [subjectName, setSubjectName] = useState('Subject Materials');
  const [activeTab, setActiveTab] = useState<'notes' | 'doubts'>('notes');
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [questions, setQuestions] = useState<DoubtQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Note Form State
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteLink, setNoteLink] = useState('');
  const [noteTags, setNoteTags] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);

  // Doubt Form State
  const [showDoubtForm, setShowDoubtForm] = useState(false);
  const [doubtTitle, setDoubtTitle] = useState('');
  const [doubtContent, setDoubtContent] = useState('');
  const [submittingDoubt, setSubmittingDoubt] = useState(false);

  // Version Control State
  const [selectedNoteForVersions, setSelectedNoteForVersions] = useState<StudyNote | null>(null);
  const [noteVersions, setNoteVersions] = useState<NoteVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [newVersionLink, setNewVersionLink] = useState('');
  const [newVersionChangelog, setNewVersionChangelog] = useState('');
  const [submittingVersion, setSubmittingVersion] = useState(false);

  const loadData = async () => {
    if (!subjectId) return;
    setLoading(true);
    try {
      const subs = await getSubjectsList();
      const currentSub = subs.find((s) => s.id === subjectId);
      if (currentSub) {
        setSubjectName(currentSub.name);
      }

      const [notesList, questionsList] = await Promise.all([
        getSubjectNotes(subjectId),
        getSubjectQuestions(subjectId),
      ]);
      setNotes(notesList);
      setQuestions(questionsList);
    } catch {
      toast.error('Failed to load subject materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subjectId]);

  const loadVersions = async (noteId: string) => {
    if (!subjectId) return;
    setLoadingVersions(true);
    try {
      const list = await getNoteVersions(subjectId, noteId);
      setNoteVersions(list);
    } catch {
      toast.error('Failed to load note versions.');
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleOpenVersions = (note: StudyNote) => {
    setSelectedNoteForVersions(note);
    loadVersions(note.id!);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !subjectId || submittingNote || !noteTitle.trim() || !noteLink.trim()) return;

    setSubmittingNote(true);
    try {
      const uploaderName = userProfile?.displayName || currentUser.displayName || 'Campus Student';
      const cleanTags = noteTags.split(',').map((t) => t.trim()).filter(Boolean);

      const noteId = await addStudyNote(subjectId, {
        title: noteTitle.trim(),
        link: noteLink.trim(),
        uploaderId: currentUser.uid,
        uploaderName,
        semester: 3,
        tags: cleanTags,
      });

      // Also create version 1 automatically in versions subcollection
      await addNoteVersion(subjectId, noteId, {
        link: noteLink.trim(),
        changelog: 'Initial version upload',
        uploaderId: currentUser.uid,
        uploaderName,
      });

      toast.success('Study note shared successfully!');
      setNoteTitle('');
      setNoteLink('');
      setNoteTags('');
      setShowNoteForm(false);
      loadData();
    } catch {
      toast.error('Failed to share study note.');
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleUploadVersion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !subjectId || !selectedNoteForVersions || submittingVersion || !newVersionLink.trim() || !newVersionChangelog.trim()) return;

    setSubmittingVersion(true);
    try {
      const uploaderName = userProfile?.displayName || currentUser.displayName || 'Campus Student';
      await addNoteVersion(subjectId, selectedNoteForVersions.id!, {
        link: newVersionLink.trim(),
        changelog: newVersionChangelog.trim(),
        uploaderId: currentUser.uid,
        uploaderName,
      });

      toast.success('New version shared successfully!');
      setNewVersionLink('');
      setNewVersionChangelog('');
      loadVersions(selectedNoteForVersions.id!);
      loadData();
    } catch {
      toast.error('Failed to share new version.');
    } finally {
      setSubmittingVersion(false);
    }
  };

  const handleCreateDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !subjectId || submittingDoubt || !doubtTitle.trim() || !doubtContent.trim()) return;

    setSubmittingDoubt(true);
    try {
      const uploaderName = userProfile?.displayName || currentUser.displayName || 'Campus Student';
      await askDoubtQuestion(subjectId, doubtTitle, doubtContent, currentUser.uid, uploaderName);

      toast.success('Doubt question asked on board!');
      setDoubtTitle('');
      setDoubtContent('');
      setShowDoubtForm(false);
      loadData();
    } catch {
      toast.error('Failed to ask doubt question.');
    } finally {
      setSubmittingDoubt(false);
    }
  };

  const handleUpvote = async (qId: string) => {
    if (!currentUser || !subjectId) return;
    try {
      await upvoteQuestion(subjectId, qId, currentUser.uid);
      loadData();
    } catch {
      toast.error('Action failed.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-4 sm:p-6 relative">
      {/* Back Button */}
      <BackButton customFallback="/academic" />

      {/* Header Banner */}
      <div className="relative p-6 rounded-3xl bg-slate-900 border border-slate-850 shadow-xl overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-lg font-black text-white uppercase tracking-wide font-mono flex items-center gap-2">
            <BookOpen className="w-5.5 h-5.5 text-emerald-400" />
            <span>{subjectName}</span>
          </h1>
          <p className="text-[10px] text-slate-405 font-mono uppercase">Course Materials & Q&A Exchange</p>
        </div>

        <div className="flex gap-2">
          {activeTab === 'notes' ? (
            <button
              onClick={() => setShowNoteForm(!showNoteForm)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Share Note</span>
            </button>
          ) : (
            <button
              onClick={() => setShowDoubtForm(!showDoubtForm)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              <span>Ask Doubt</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex bg-slate-900 p-1 border border-slate-850 rounded-2xl">
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'notes' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Study resources
        </button>
        <button
          onClick={() => setActiveTab('doubts')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'doubts' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
          }`}
        >
          Doubt Clearing
        </button>
      </div>

      {/* Share Note Form */}
      {showNoteForm && activeTab === 'notes' && (
        <form onSubmit={handleCreateNote} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Share Study Resource</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Resource Title</label>
              <input
                type="text"
                required
                value={noteTitle}
                onChange={(e) => setNoteTitle(e.target.value)}
                placeholder="e.g. Unit 3 Stack and Queues Lecture Slides"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Download Link / URL</label>
              <input
                type="url"
                required
                value={noteLink}
                onChange={(e) => setNoteLink(e.target.value)}
                placeholder="e.g. https://drive.google.com/..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Tags (Comma-separated)</label>
            <input
              type="text"
              value={noteTags}
              onChange={(e) => setNoteTags(e.target.value)}
              placeholder="e.g. exam, slides, queues"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submittingNote}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
          >
            {submittingNote ? 'Uploading note...' : 'Share Note'}
          </button>
        </form>
      )}

      {/* Ask Doubt Form */}
      {showDoubtForm && activeTab === 'doubts' && (
        <form onSubmit={handleCreateDoubt} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
          <h2 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Ask Doubt / Question</h2>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Doubt Title / Question</label>
            <input
              type="text"
              required
              value={doubtTitle}
              onChange={(e) => setDoubtTitle(e.target.value)}
              placeholder="e.g. How does bubble sort compare to merge sort time complexity?"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Elaborate Details</label>
            <textarea
              required
              rows={4}
              value={doubtContent}
              onChange={(e) => setDoubtContent(e.target.value)}
              placeholder="Describe what part of the problem you are stuck on..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={submittingDoubt}
            className="w-full py-2 bg-emerald-500 hover:bg-emerald-405 disabled:bg-slate-800 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md"
          >
            {submittingDoubt ? 'Submitting Question...' : 'Askdoubt question'}
          </button>
        </form>
      )}

      {/* Main Grid View */}
      {loading ? (
        <div className="p-8 text-center text-slate-500 text-xs">Loading subject coordinates...</div>
      ) : activeTab === 'notes' ? (
        <div className="space-y-4">
          {notes.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
              No lecture notes shared yet. Click "Share Note" to share study materials.
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="p-5 bg-slate-900 border border-slate-850 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <h3 className="text-xs font-bold text-white leading-snug">{note.title}</h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] text-slate-500 font-mono">Uploader: {note.uploaderName}</span>
                    {note.tags.map((t) => (
                      <span
                        key={t}
                        className="px-2 py-0.5 bg-slate-950 border border-slate-850 text-slate-400 rounded-full font-mono text-[8px]"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  {/* Versions History Button */}
                  <button
                    onClick={() => handleOpenVersions(note)}
                    className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl text-sky-400 hover:text-sky-350 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                    title="Version History"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Versions</span>
                  </button>

                  <a
                    href={note.link}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 rounded-xl text-emerald-400 hover:text-emerald-350 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs italic bg-slate-900 border border-slate-850 rounded-3xl">
              No doubt questions asked yet. Ask the community!
            </div>
          ) : (
            questions.map((q) => {
              const isUserUpvoted = q.upvotedBy?.includes(currentUser?.uid || '');

              return (
                <div
                  key={q.id}
                  className="p-5 bg-slate-900 border border-slate-850 rounded-3xl space-y-3.5 shadow-md relative overflow-hidden"
                >
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-white leading-snug">{q.title}</h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{q.content}</p>
                    <p className="text-[9px] text-slate-500 font-mono">Asked by: {q.uploaderName}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleUpvote(q.id!)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-mono border transition-all ${
                          isUserUpvoted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                            : 'bg-slate-950 border-slate-850 hover:border-slate-800 text-slate-450 hover:text-white'
                        }`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>{q.upvotes || 0} Upvotes</span>
                      </button>

                      {q.acceptedAnswerId && (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2.5 py-0.5 rounded-full font-mono">
                          <Award className="w-3.5 h-3.5" />
                          <span>SOLVED</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => navigate(`/academic/subjects/${subjectId}/questions/${q.id}`)}
                      className="px-3.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Discuss</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Note Version History Drawer Overlay */}
      {selectedNoteForVersions && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between shadow-2xl rounded-3xl sm:rounded-l-3xl sm:rounded-r-none overflow-y-auto">
            <div className="space-y-6">
              <div className="flex justify-between items-start border-b border-slate-805 pb-4">
                <div>
                  <h3 className="text-xs font-black uppercase font-mono text-slate-400 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-sky-400 animate-spin" />
                    <span>Version History Control</span>
                  </h3>
                  <h4 className="text-sm font-bold text-white mt-1">{selectedNoteForVersions.title}</h4>
                </div>
                <button
                  onClick={() => setSelectedNoteForVersions(null)}
                  className="px-2.5 py-1.5 bg-slate-950 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-white rounded-xl text-[10px] font-bold uppercase transition-all"
                >
                  Close
                </button>
              </div>

              {/* Version History List */}
              <div className="space-y-3">
                <h5 className="text-[10px] uppercase font-bold text-slate-500 font-mono tracking-wider">Uploaded Versions</h5>
                {loadingVersions ? (
                  <div className="flex items-center gap-2 text-slate-450 text-xs py-4">
                    <RefreshCw className="w-4 h-4 animate-spin text-sky-400" />
                    <span>Querying git versions...</span>
                  </div>
                ) : noteVersions.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-4">No version logs recorded.</p>
                ) : (
                  <div className="space-y-3">
                    {noteVersions.map((v) => (
                      <div
                        key={v.id}
                        className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-2 flex flex-col justify-between"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 bg-slate-900 border border-slate-800 text-sky-400 text-[9px] font-bold font-mono rounded-full">
                            v{v.versionNumber}
                          </span>
                          <span className="text-[9px] text-slate-500 font-mono">
                            Uploaded by {v.uploaderName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium">Changelog: {v.changelog}</p>
                        <a
                          href={v.link}
                          target="_blank"
                          rel="noreferrer"
                          className="self-end px-3 py-1.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 rounded-xl text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Get v{v.versionNumber}</span>
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload New Version Form */}
              <form onSubmit={handleUploadVersion} className="pt-4 border-t border-slate-800 space-y-4">
                <h5 className="text-[10px] uppercase font-bold text-slate-400 font-mono tracking-wider">Push New Note Version</h5>
                
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block">New File Link</label>
                  <input
                    type="url"
                    required
                    value={newVersionLink}
                    onChange={(e) => setNewVersionLink(e.target.value)}
                    placeholder="e.g. https://drive.google.com/..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase font-mono block">Changelog / Changes made</label>
                  <textarea
                    required
                    rows={2}
                    value={newVersionChangelog}
                    onChange={(e) => setNewVersionChangelog(e.target.value)}
                    placeholder="e.g. Added section on Queue structures and corrected typos"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingVersion}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{submittingVersion ? 'Publishing Version...' : 'Push Version'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
