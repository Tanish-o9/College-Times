import React, { useState } from 'react';
import { useAuth } from '../../../hooks/useAuth';
import { createIncident } from '../../../services/incidentService';
import type { IncidentCategory, IncidentSeverity, AffectedArea } from '../../../types/incident';
import {
  X,
  AlertTriangle,
  Send,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateIncidentFormProps {
  onClose: () => void;
  onSuccess: (incidentId: string) => void;
}

export const CreateIncidentForm: React.FC<CreateIncidentFormProps> = ({ onClose, onSuccess }) => {
  const { currentUser, userProfile } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('accident');
  const [severity, setSeverity] = useState<IncidentSeverity>('moderate');
  const [locationName, setLocationName] = useState('');
  const [affectedArea, setAffectedArea] = useState<AffectedArea>('campus');
  const [affectedAreaId] = useState('');
  const [emergencyInstructions, setEmergencyInstructions] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || userProfile?.role !== 'admin') {
      toast.error('Unauthorized: Admin access required.');
      return;
    }

    if (!title.trim() || title.length > 100) {
      toast.error('Title is required and must be 100 characters or fewer.');
      return;
    }
    if (!summary.trim() || summary.length > 500) {
      toast.error('Summary is required and must be 500 characters or fewer.');
      return;
    }
    if (!locationName.trim() || locationName.length > 150) {
      toast.error('Location Name is required and must be 150 characters or fewer.');
      return;
    }

    setSubmitting(true);
    try {
      const newId = await createIncident(
        {
          title: title.trim(),
          summary: summary.trim(),
          category,
          severity,
          locationName: locationName.trim(),
          affectedArea,
          affectedAreaId: affectedAreaId.trim() || undefined,
          emergencyInstructions: emergencyInstructions.trim() || undefined,
        },
        currentUser,
        userProfile
      );

      toast.success('Incident reported successfully!');
      onSuccess(newId);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create incident.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Report Campus Emergency Incident</h3>
            <p className="text-[11px] text-slate-400">Initialize live incident tracking & status updates</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Incident Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Fire alarm reported near Block C"
              maxLength={100}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all font-sans text-xs"
            />
          </div>

          {/* Category & Severity */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Category
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
                <option value="other">Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Severity Level
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500 transition-all text-xs"
              >
                <option value="low">🟢 Low</option>
                <option value="moderate">🟡 Moderate</option>
                <option value="high">🟠 High</option>
                <option value="critical">🔴 Critical</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Incident Summary *
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Brief details of the incident..."
              maxLength={500}
              rows={3}
              required
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all text-xs resize-none"
            />
          </div>

          {/* Location & Affected Area */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Location Name *
              </label>
              <input
                type="text"
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                placeholder="e.g. Block C, 2nd Floor"
                maxLength={150}
                required
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Affected Area
              </label>
              <select
                value={affectedArea}
                onChange={(e) => setAffectedArea(e.target.value as AffectedArea)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-sky-500 transition-all text-xs"
              >
                <option value="campus">Campus-Wide</option>
                <option value="department">Department</option>
                <option value="building">Specific Building</option>
                <option value="batch">Specific Batch</option>
                <option value="community">Community Group</option>
              </select>
            </div>
          </div>

          {/* Emergency Instructions */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Emergency Instructions (Optional)
            </label>
            <textarea
              value={emergencyInstructions}
              onChange={(e) => setEmergencyInstructions(e.target.value)}
              placeholder="e.g. Students near Block C should avoid the area until further notice."
              maxLength={500}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-all text-xs resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Reporting...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Create Incident</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
