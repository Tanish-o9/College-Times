import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { DirectMessage, DirectConversation } from '../../types/directMessage';
import { useAuth } from '../../hooks/useAuth';
import { 
  getDirectMessages, 
  sendDirectMessage, 
  updateConversationStatus, 
  blockUser 
} from '../../services/directMessageService';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import { 
  ArrowLeft, 
  Send, 
  RefreshCw, 
  ShieldAlert, 
  UserX, 
  Check, 
  X, 
  MessageSquare,
  Lock
} from 'lucide-react';

export const DirectMessageRoom: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [conversation, setConversation] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputContent, setInputContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Derive target participant UID & Name
  const targetUid = conversation?.participantIds.find((id) => id !== currentUser?.uid);
  const targetName = targetUid && conversation?.participantNames
    ? conversation.participantNames[targetUid] || 'Campus Peer'
    : 'Campus Peer';

  const isPendingRequest = conversation?.status === 'pending' && conversation?.lastMessageSenderId !== currentUser?.uid;
  const isBlocked = conversation?.status === 'blocked';

  // Listen to active conversation doc in realtime
  useEffect(() => {
    if (!conversationId || !currentUser) return;
    const convRef = doc(db, 'conversations', conversationId);

    const unsubscribe = onSnapshot(convRef, (snap) => {
      if (snap.exists()) {
        setConversation({ id: snap.id, ...snap.data() } as DirectConversation);
      }
    });

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  // Load initial 50 messages
  const loadMessages = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const list = await getDirectMessages(conversationId, 50);
      setMessages(list);
    } catch (err) {
      toast.error('Failed to load messages.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !conversationId || !inputContent.trim() || sending) return;

    setSending(true);
    try {
      const newMsg = await sendDirectMessage(conversationId, inputContent, currentUser);
      setMessages((prev) => [...prev, newMsg]);
      setInputContent('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!currentUser || !conversationId) return;
    try {
      await updateConversationStatus(conversationId, 'active', currentUser);
      toast.success('Message request accepted!');
    } catch (err) {
      toast.error('Failed to accept request.');
    }
  };

  const handleDeclineRequest = async () => {
    if (!currentUser || !conversationId) return;
    try {
      await updateConversationStatus(conversationId, 'declined', currentUser);
      toast.success('Message request declined.');
      navigate('/messages');
    } catch (err) {
      toast.error('Failed to decline request.');
    }
  };

  const handleBlockUser = async () => {
    if (!currentUser || !targetUid) return;
    try {
      await blockUser(targetUid, targetName, currentUser);
      toast.success(`Blocked ${targetName}.`);
    } catch (err) {
      toast.error('Failed to block user.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto h-[calc(100vh-5rem)] flex flex-col py-4 px-3 sm:px-4">
      {/* Header Bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-3 shadow-lg shrink-0">
        <div className="flex items-center gap-3 truncate">
          <button
            onClick={() => navigate('/messages')}
            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl border border-slate-800"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="truncate">
            <h2 className="text-sm font-bold text-white truncate flex items-center gap-2">
              <span>{targetName}</span>
              {isBlocked && (
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-[10px] font-bold">
                  BLOCKED
                </span>
              )}
            </h2>
            <p className="text-[11px] text-slate-500 truncate">Campus Peer (Private 1-on-1)</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isBlocked && (
            <button
              onClick={handleBlockUser}
              className="p-2 bg-slate-950 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 rounded-xl border border-slate-800"
              title="Block User"
            >
              <UserX className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Message Request Banner */}
      {isPendingRequest && (
        <div className="my-3 p-4 bg-purple-500/10 border border-purple-500/20 rounded-2xl space-y-2 shrink-0">
          <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 text-purple-400" />
            <span>Message Request from {targetName}</span>
          </div>
          <p className="text-xs text-slate-400">
            Accepting allows {targetName} to message you. You can decline or block anytime.
          </p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleAcceptRequest}
              className="px-4 py-1.5 bg-purple-500 hover:bg-purple-400 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept</span>
            </button>
            <button
              onClick={handleDeclineRequest}
              className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Decline</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Messages List */}
      <div className="flex-1 overflow-y-auto py-4 space-y-3 px-1">
        {loading ? (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
            <span>Loading private conversation...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="py-12 text-center space-y-2 text-slate-500">
            <MessageSquare className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs italic">No messages yet. Send a message to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser?.uid;
            const isDeleted = msg.status === 'deleted';

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3.5 rounded-2xl space-y-1 ${
                    isMe
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none'
                  }`}
                >
                  {isDeleted ? (
                    <p className="text-xs italic text-slate-400">This message was deleted.</p>
                  ) : (
                    <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </p>
                  )}
                </div>

                <span className="text-[10px] text-slate-500 px-1 mt-1 font-mono">
                  {msg.createdAt
                    ? typeof msg.createdAt.toDate === 'function'
                      ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Composer Bar */}
      {isBlocked ? (
        <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl text-center text-xs text-rose-400 font-semibold flex items-center justify-center gap-1.5 shrink-0">
          <Lock className="w-4 h-4" />
          <span>Messaging is disabled for blocked conversations.</span>
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex items-center gap-2 pt-2 border-t border-slate-800 shrink-0">
          <input
            type="text"
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            placeholder="Type a private message..."
            disabled={sending}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-medium"
          />

          <button
            type="submit"
            disabled={sending || !inputContent.trim()}
            className="p-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all shrink-0"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      )}
    </div>
  );
};
