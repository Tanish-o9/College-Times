import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { BackButton } from '../../components/BackButton';
import {
  getSubjectQuestions,
  getQuestionAnswers,
  answerDoubtQuestion,
  markAcceptedAnswer,
  type DoubtQuestion,
  type DoubtAnswer
} from '../../services/academicService';
import { Award, RefreshCw, Send, HelpCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';

export const QuestionBoard: React.FC = () => {
  const { subjectId, questionId } = useParams<{ subjectId: string; questionId: string }>();
  const { currentUser } = useAuth();

  const [question, setQuestion] = useState<DoubtQuestion | null>(null);
  const [answers, setAnswers] = useState<DoubtAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [ansText, setAnsText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    if (!subjectId || !questionId) return;
    setLoading(true);
    try {
      const qList = await getSubjectQuestions(subjectId);
      const currentQ = qList.find((q) => q.id === questionId);
      if (currentQ) {
        setQuestion(currentQ);
      }

      const answersList = await getQuestionAnswers(subjectId, questionId);
      setAnswers(answersList);
    } catch {
      toast.error('Failed to load thread details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [subjectId, questionId]);

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !subjectId || !questionId || submitting || !ansText.trim()) return;

    setSubmitting(true);
    try {
      const uploaderName = currentUser.displayName || 'Campus Peer';
      await answerDoubtQuestion(subjectId, questionId, ansText, currentUser.uid, uploaderName);
      toast.success('Your answer has been posted!');
      setAnsText('');
      loadData();
    } catch {
      toast.error('Failed to post answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptAnswer = async (ansId: string) => {
    if (!subjectId || !questionId) return;
    try {
      await markAcceptedAnswer(subjectId, questionId, ansId);
      setQuestion((prev) => (prev ? { ...prev, acceptedAnswerId: ansId } : null));
      toast.success('Marked answer as accepted solution! 🏆');
    } catch {
      toast.error('Failed to mark accepted solution.');
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs">Loading thread details...</div>
    );
  }

  if (!question) {
    return (
      <div className="p-12 text-center text-slate-500 text-xs italic">
        Doubt question thread not found.
      </div>
    );
  }

  const isQuestionOwner = currentUser?.uid === question.uploaderId;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Navigation header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <BackButton customFallback={`/academic/subjects/${subjectId}`} />

        <button
          onClick={loadData}
          className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-300 rounded-xl transition-all"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Asked Doubt Detail Card */}
      <div className="p-6 bg-slate-900 border border-slate-805 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-start gap-3">
          <HelpCircle className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-base font-black text-white leading-tight">{question.title}</h1>
            <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap">{question.content}</p>
            <p className="text-[10px] text-slate-500 font-mono">Posted by: {question.uploaderName}</p>
          </div>
        </div>
      </div>

      {/* Answers List */}
      <div className="space-y-3.5">
        <h3 className="text-xs font-bold text-slate-450 uppercase font-mono tracking-wider">
          Discussion ({answers.length})
        </h3>

        {answers.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-6 bg-slate-900/30 border border-slate-850 rounded-2xl text-center">
            No replies or solutions posted yet. Write the first answer!
          </p>
        ) : (
          answers.map((ans) => {
            const isAccepted = question.acceptedAnswerId === ans.id;

            return (
              <div
                key={ans.id}
                className={`p-5 rounded-3xl border shadow-md flex flex-col gap-3 relative overflow-hidden ${
                  isAccepted
                    ? 'bg-emerald-950/10 border-emerald-500/30'
                    : 'bg-slate-900 border-slate-850'
                }`}
              >
                {isAccepted && (
                  <div className="absolute top-0 right-0 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
                )}

                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{ans.text}</p>
                    <p className="text-[9px] text-slate-500 font-mono">Answered by: {ans.uploaderName}</p>
                  </div>

                  <div className="flex gap-2 items-center shrink-0">
                    {isAccepted ? (
                      <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-full font-mono">
                        <Award className="w-3.5 h-3.5" />
                        <span>SOLUTION</span>
                      </span>
                    ) : (
                      isQuestionOwner && (
                        <button
                          onClick={() => handleAcceptAnswer(ans.id!)}
                          className="px-2.5 py-1 bg-slate-950 hover:bg-emerald-500/10 border border-slate-850 hover:border-emerald-500/30 text-slate-400 hover:text-emerald-400 text-[9px] font-bold uppercase rounded-lg transition-all flex items-center gap-0.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Accept Solution</span>
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Post Answer Form */}
      <form onSubmit={handleSubmitAnswer} className="p-5 bg-slate-900 border border-slate-800 rounded-3xl space-y-4 shadow-xl">
        <h3 className="text-xs font-bold text-white uppercase font-mono tracking-wider">Your Contribution</h3>
        <div>
          <textarea
            required
            rows={3}
            value={ansText}
            onChange={(e) => setAnsText(e.target.value)}
            placeholder="Write your explanation or code coordinates here..."
            className="w-full bg-slate-950 border border-slate-805 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none resize-none"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 bg-emerald-500 hover:bg-emerald-405 disabled:bg-slate-850 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
        >
          {submitting ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit Answer</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
