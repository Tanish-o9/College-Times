import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { queryCampusAssistant, type AssistantMessage } from '../../services/campusAssistantService';
import { Bot, Send, User, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const AiAssistantPage: React.FC = () => {
  const { currentUser, userProfile } = useAuth();

  const [messages, setMessages] = useState<AssistantMessage[]>([
    {
      sender: 'assistant',
      text: `Hi ${userProfile?.displayName || 'there'}! I am your AI Campus Assistant. Ask me anything about upcoming events, study materials, or internships.`,
      createdAt: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || loading || !inputText.trim()) return;

    const userPrompt = inputText.trim();
    setInputText('');

    const newMsg: AssistantMessage = {
      sender: 'user',
      text: userPrompt,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);

    try {
      const response = await queryCampusAssistant(userPrompt, currentUser.uid, userProfile as any);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: response,
          createdAt: new Date(),
        },
      ]);
    } catch {
      toast.error('Failed to get a response from assistant.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[80vh] bg-slate-900 border border-slate-805 rounded-3xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-850 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider font-mono">AI Campus Assistant</h1>
            <p className="text-[10px] text-slate-500 font-mono">Real-time permission-aware search bot</p>
          </div>
        </div>

        <button
          onClick={() =>
            setMessages([
              {
                sender: 'assistant',
                text: 'How can I assist you with your campus queries today?',
                createdAt: new Date(),
              },
            ])
          }
          className="p-2 bg-slate-900 hover:bg-slate-850 border border-slate-850 rounded-xl text-slate-400 hover:text-white transition-all text-xs font-bold"
        >
          Reset Thread
        </button>
      </div>

      {/* Chat Messages Log */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4">
        {messages.map((msg, idx) => {
          const isAI = msg.sender === 'assistant';

          return (
            <div key={idx} className={`flex gap-3 max-w-xl ${isAI ? '' : 'ml-auto flex-row-reverse'}`}>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border text-slate-350 ${
                  isAI
                    ? 'bg-purple-500/10 border-purple-500/20 text-purple-400'
                    : 'bg-slate-950 border-slate-850'
                }`}
              >
                {isAI ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
              </div>

              <div
                className={`p-4 rounded-2xl border text-xs leading-relaxed ${
                  isAI
                    ? 'bg-slate-950/60 border-slate-850 text-slate-300'
                    : 'bg-purple-500 text-slate-950 font-bold border-purple-650'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3 max-w-xl">
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-850 text-slate-500 text-xs flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-400" />
              <span>Analyzing index coordinates...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="p-4 bg-slate-950 border-t border-slate-850 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask me: 'What events are happening?' or 'Show lecture notes'"
          className="flex-1 bg-slate-900 border border-slate-805 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/40"
        />
        <button
          type="submit"
          disabled={loading}
          className="p-2.5 bg-purple-500 hover:bg-purple-400 disabled:bg-slate-850 text-slate-950 rounded-xl transition-all shadow-md shrink-0"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>
    </div>
  );
};
