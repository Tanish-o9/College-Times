import React, { useEffect, useState } from 'react';
import type { GroupFile } from '../../services/groupFileService';
import { useAuth } from '../../hooks/useAuth';
import {
  uploadGroupFile,
  getGroupFiles,
  deleteGroupFile,
} from '../../services/groupFileService';
import toast from 'react-hot-toast';
import {
  Paperclip,
  Trash2,
  Download,
  FolderOpen,
  Plus,
  X,
  RefreshCw,
  FolderLock
} from 'lucide-react';

interface GroupFilesProps {
  groupId: string;
  isMember: boolean;
}

export const GroupFiles: React.FC<GroupFilesProps> = ({ groupId, isMember }) => {
  const { currentUser, userProfile } = useAuth();
  const [files, setFiles] = useState<GroupFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);

  // Modal State
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  useEffect(() => {
    if (!groupId) return;
    const fetchFiles = async () => {
      setLoading(true);
      const list = await getGroupFiles(groupId);
      setFiles(list);
      setLoading(false);
    };
    fetchFiles();
  }, [groupId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !fileToUpload) {
      toast.error('Please select a file to upload.');
      return;
    }

    setUploading(true);
    const toastId = toast.loading(`Uploading ${fileToUpload.name}...`);
    try {
      const newFile = await uploadGroupFile(
        groupId,
        fileToUpload,
        title || fileToUpload.name,
        description,
        currentUser,
        userProfile?.displayName || currentUser.displayName || 'Campus Member'
      );

      setFiles((prev) => [newFile, ...prev]);
      setFileToUpload(null);
      setTitle('');
      setDescription('');
      setShowUploadModal(false);
      toast.success('File uploaded successfully!', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Upload failed.', { id: toastId });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (file: GroupFile) => {
    if (!currentUser || !file.id) return;
    if (!window.confirm(`Are you sure you want to delete "${file.fileName}"?`)) return;

    try {
      await deleteGroupFile(groupId, file.id, currentUser);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      toast.success('File deleted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete file.');
    }
  };

  const getFileIcon = (mimeType: string) => {
    const lower = mimeType.toLowerCase();
    if (lower.startsWith('image/')) return '🖼️';
    if (lower.startsWith('video/')) return '🎥';
    if (lower.startsWith('audio/')) return '🎵';
    if (lower.includes('pdf')) return '📕';
    if (lower.includes('zip') || lower.includes('tar') || lower.includes('rar')) return '📦';
    return '📄';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-sky-400" />
          <span>Shared Group Files</span>
        </h3>

        {isMember && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Upload File</span>
          </button>
        )}
      </div>

      {!isMember && (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-2">
          <FolderLock className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400 italic">Group attachments are only available to members.</p>
        </div>
      )}

      {isMember && (
        <div>
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading files...</div>
          ) : files.length === 0 ? (
            <div className="p-12 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-2 text-slate-500 italic text-xs">
              <FolderOpen className="w-8 h-8 mx-auto text-slate-600" />
              <span>No shared files inside this group yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {files.map((file) => {
                const canDeleteFile = file.uploadedBy === currentUser?.uid || userProfile?.role === 'admin';

                return (
                  <div
                    key={file.id}
                    className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-start justify-between gap-3 hover:border-slate-700 transition-all shadow-md"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-lg shrink-0">
                        {getFileIcon(file.mimeType)}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <h4 className="text-xs font-bold text-white truncate" title={file.title}>
                          {file.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-mono truncate">
                          {file.fileName} ({formatFileSize(file.fileSize)})
                        </p>
                        {file.description && (
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed pt-0.5 break-words">
                            {file.description}
                          </p>
                        )}
                        <p className="text-[9px] text-slate-500 pt-1">
                          Uploaded by <span className="font-bold text-sky-400/80">{file.uploadedByName}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={file.downloadUrl}
                        download={file.fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800 transition-all"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      {canDeleteFile && (
                        <button
                          onClick={() => handleDelete(file)}
                          className="p-2 bg-slate-950 hover:bg-rose-500/10 text-slate-500 hover:text-rose-400 rounded-xl border border-slate-800 transition-all"
                          title="Delete file"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
          <form onSubmit={handleUpload} className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Paperclip className="w-5 h-5 text-sky-400" />
                <span>Upload Group Attachment</span>
              </h3>
              <button type="button" onClick={() => setShowUploadModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Select File * (Max 10MB)</label>
                <input
                  type="file"
                  required
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFileToUpload(file);
                      if (!title) setTitle(file.name);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-sky-500 file:bg-slate-900 file:border-none file:text-[10px] file:text-slate-300 file:font-black file:rounded file:px-2 file:py-1 file:mr-2"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Display Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Study Guide 1"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add a short description of the file..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-sky-500/10 transition-all flex items-center justify-center gap-1.5"
            >
              {uploading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Uploading File...</span>
                </>
              ) : (
                <span>Upload File</span>
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
