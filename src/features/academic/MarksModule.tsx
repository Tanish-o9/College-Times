import React, { useState } from 'react';
import type { AcademicMarksRecord, AcademicProfile } from '../../types/academic';
import { computeMarksSummary } from '../../services/academic/academicStorageService';
import {
  Award,
  Filter,
  RefreshCw,
  Search
} from 'lucide-react';

interface MarksModuleProps {
  marks: AcademicMarksRecord[];
  profile: AcademicProfile | null;
  onOpenSync: () => void;
}

export const MarksModule: React.FC<MarksModuleProps> = ({
  marks,
  profile,
  onOpenSync,
}) => {
  const [selectedSem, setSelectedSem] = useState<number | 'all'>(profile?.semester || 'all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Extract unique available semesters from actual fetched records
  const availableSemesters = Array.from(
    new Set(marks.map((m) => m.semester).filter(Boolean))
  ).sort((a, b) => a - b);

  const filteredMarks = marks.filter((m) => {
    const matchesSem = selectedSem === 'all' || m.semester === selectedSem;
    const matchesSearch =
      !searchQuery ||
      m.subjectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.subjectCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.assessmentType.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSem && matchesSearch;
  });

  const summary = computeMarksSummary(filteredMarks);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner & Summary */}
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Award className="w-5 h-5 text-purple-400" />
              <span>Academic Marks & Evaluation</span>
            </h2>
            <p className="text-xs text-slate-400 font-mono">
              Internal tests, Mid Sems, Quizzes & Practical evaluations fetched from Edumarsal
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenSync}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-slate-700 text-xs font-semibold flex items-center gap-1.5 self-start sm:self-auto transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
            <span>Sync Marks</span>
          </button>
        </div>

        {/* Global Marks Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800 font-mono text-xs">
          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Overall Percentage</span>
            <span className="text-2xl font-black text-white mt-0.5 block">{summary.overallPercentage}%</span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Evaluated Subjects</span>
            <span className="text-xl font-bold text-purple-400 mt-0.5 block">{summary.totalSubjects}</span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Highest Score</span>
            <span className="text-xl font-bold text-emerald-400 mt-0.5 block truncate">
              {summary.highestSubject ? `${summary.highestSubject.percentage}%` : 'N/A'}
            </span>
          </div>

          <div className="p-3.5 bg-slate-950/70 border border-slate-850 rounded-2xl">
            <span className="text-[10px] text-slate-500 font-bold uppercase block">Total Assessments</span>
            <span className="text-xl font-bold text-sky-400 mt-0.5 block">{filteredMarks.length}</span>
          </div>
        </div>
      </div>

      {/* Controls Strip: Semester Filter & Search Input */}
      <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
        {/* Semester Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 scrollbar-none">
          <span className="text-xs font-mono font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-purple-400" /> Filter:
          </span>

          <button
            type="button"
            onClick={() => setSelectedSem('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
              selectedSem === 'all'
                ? 'bg-purple-500 text-slate-950 font-extrabold shadow-md'
                : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            All Semesters
          </button>

          {availableSemesters.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSem(s)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono transition-all ${
                selectedSem === s
                  ? 'bg-purple-500 text-slate-950 font-extrabold shadow-md'
                  : 'bg-slate-950/80 border border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Sem {s}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject or test..."
            className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Marks Table / Cards View */}
      {filteredMarks.length === 0 ? (
        <div className="p-12 bg-slate-900 border border-slate-800 rounded-3xl text-center space-y-3">
          <p className="text-xs text-slate-400">No marks recorded for this filter selection.</p>
          <button onClick={onOpenSync} className="px-4 py-2 bg-purple-500 text-slate-950 font-bold text-xs rounded-xl">
            Sync Edumarsal Marks
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/90 shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                  <th className="p-4">Subject</th>
                  <th className="p-4">Assessment</th>
                  <th className="p-4 text-center">Score</th>
                  <th className="p-4 text-center">Percentage</th>
                  <th className="p-4 text-center">Grade</th>
                  <th className="p-4 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs">
                {filteredMarks.map((m, idx) => (
                  <tr key={m.id || idx} className="hover:bg-slate-850/60 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-white">{m.subjectName}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m.subjectCode} • Sem {m.semester}</div>
                    </td>
                    <td className="p-4 font-mono text-slate-300">{m.assessmentType}</td>
                    <td className="p-4 text-center font-mono font-bold text-white">
                      {m.obtainedMarks} / {m.maxMarks}
                    </td>
                    <td className="p-4 text-center font-mono font-bold">
                      <span className={m.percentage >= 80 ? 'text-emerald-400' : m.percentage >= 65 ? 'text-sky-300' : 'text-amber-400'}>
                        {m.percentage}%
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-lg text-xs font-bold font-mono">
                        {m.grade || 'A'}
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-400 font-mono text-[11px]">
                      {m.date || 'Recent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filteredMarks.map((m, idx) => (
              <div
                key={m.id || idx}
                className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="px-2 py-0.5 bg-slate-950 border border-slate-850 text-purple-300 font-mono text-[10px] font-bold rounded-md">
                      {m.subjectCode}
                    </span>
                    <h4 className="text-xs font-bold text-white mt-1">{m.subjectName}</h4>
                  </div>

                  <span className="px-2.5 py-1 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-bold font-mono">
                    Grade {m.grade || 'A'}
                  </span>
                </div>

                <div className="flex items-center justify-between font-mono text-xs pt-2 border-t border-slate-800">
                  <span className="text-slate-400">{m.assessmentType}</span>
                  <span className="font-bold text-white">{m.obtainedMarks} / {m.maxMarks} ({m.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
