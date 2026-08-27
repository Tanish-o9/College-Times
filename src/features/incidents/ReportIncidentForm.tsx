import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  createIncidentReport,
  uploadEvidenceFile,
} from '../../services/incidentReportService';
import type { EvidenceAttachment } from '../../types/incidentReport';
import type { IncidentCategory } from '../../types/alert';
import {
  X,
  AlertTriangle,
  UploadCloud,
  Send,
  RefreshCw,
  Image as ImageIcon,
  Film
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ReportIncidentFormProps {
  onClose?: () => void;
}

export const ReportIncidentForm: React.FC<ReportIncidentFormProps> = ({ onClose }) => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [category, setCategory] = useState<IncidentCategory>('accident');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    if (files.length + selectedFiles.length > 5) {
      toast.error('Maximum of 5 evidence files allowed.');
      return;
    }

    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`File '${f.name}' exceeds 10MB limit.`);
        return;
      }
    }

    setSelectedFiles((prev) => [...prev, ...files]);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error('Please log in to submit a report.');
      return;
    }

    if (!description.trim() || description.trim().length < 10 || description.trim().length > 1000) {
      toast.error('Description must be between 10 and 1000 characters.');
      return;
    }

    if (!locationName.trim() || locationName.trim().length > 150) {
      toast.error('Location is required and must be 150 characters or fewer.');
      return;
    }

    setSubmitting(true);
    const tempReportId = `rep_${Date.now()}`;

    try {
      const uploadedAttachments: EvidenceAttachment[] = [];

      // Upload evidence files
      for (const file of selectedFiles) {
        const attachment = await uploadEvidenceFile(
          file,
          tempReportId,
          currentUser.uid,
          (pct) => {
            setUploadProgress((prev) => ({ ...prev, [file.name]: pct }));
          }
        );
        uploadedAttachments.push(attachment);
      }

      await createIncidentReport(
        {
          category,
          description: description.trim(),
          locationName: locationName.trim(),
          evidence: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
        },
        currentUser,
        userProfile
      );

      toast.success('Incident report submitted for verification!');
      if (onClose) onClose();
      navigate('/my-reports');
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit report. Draft preserved.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl max-w-xl w-full mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Report Campus Incident</h2>
            <p className="text-[11px] text-slate-400">Submits report for administrative verification</p>
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Category */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
            Incident Category *
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as IncidentCategory)}
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500 transition-all text-xs"
          >
            <option value="accident">Accident</option>
            <option value="medical">Medical Emergency</option>
            <option value="fire">Fire Alarm / Hazard</option>
            <option value="security">Security Alert</option>
            <option value="weather">Weather Warning</option>
            <option value="infrastructure">Infrastructure Issue</option>
            <option value="transport">Transport Disruption</option>
            <option value="lost_found">Lost & Found Incident</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Location */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
            Approximate Campus Location *
          </label>
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="e.g. Near Main Gate, Academic Block C"
            maxLength={150}
            required
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all font-sans text-xs"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
            Incident Description * (10-1000 characters)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you observed..."
            minLength={10}
            maxLength={1000}
            rows={4}
            required
            className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all text-xs resize-none"
          />
        </div>

        {/* Evidence Attachments File Picker */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
            Attach Photo/Video Evidence (Optional, max 5 files, 10MB each)
          </label>

          <label className="border-2 border-dashed border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all bg-slate-950/40">
            <UploadCloud className="w-6 h-6 text-sky-400" />
            <span className="text-[11px] text-slate-400 font-semibold">
              Click to select JPEG, PNG, WEBP, MP4, or WEBM files
            </span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {selectedFiles.length > 0 && (
            <div className="space-y-2 pt-1">
              {selectedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {file.type.startsWith('video/') ? (
                      <Film className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <span className="text-xs text-slate-200 truncate">{file.name}</span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      ({(file.size / (1024 * 1024)).toFixed(1)}MB)
                    </span>
                    {uploadProgress[file.name] !== undefined && (
                      <span className="text-[10px] text-sky-400 font-mono font-bold">
                        {uploadProgress[file.name]}%
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(idx)}
                    className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Submitting for Verification...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Submit Incident Report</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
