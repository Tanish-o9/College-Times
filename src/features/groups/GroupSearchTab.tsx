import React, { useState } from 'react';
import { Search, Sparkles, Users, RefreshCw, FileText, Megaphone, Calendar } from 'lucide-react';
import { searchGroupMembers } from '../../services/groupMemberManagementService';
import { searchGroupChatMessages } from '../../services/groupChatService';
import type { GroupMember, GroupAnnouncement } from '../../types/group';
import type { ChatMessage } from '../../types/chat';
import type { Post, CampusEvent } from '../../types';
import { collection, query, where, limit, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { PostCard } from '../feed/PostCard';

interface GroupSearchTabProps {
  groupId: string;
}

export const GroupSearchTab: React.FC<GroupSearchTabProps> = ({ groupId }) => {
  const [queryText, setQueryText] = useState('');
  const [searching, setSearching] = useState(false);
  const [memberResults, setMemberResults] = useState<GroupMember[]>([]);
  const [chatResults, setChatResults] = useState<ChatMessage[]>([]);
  const [postResults, setPostResults] = useState<Post[]>([]);
  const [announcementResults, setAnnouncementResults] = useState<GroupAnnouncement[]>([]);
  const [eventResults, setEventResults] = useState<CampusEvent[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !queryText.trim() || searching) return;

    setSearching(true);
    try {
      const channelId = `group-${groupId}`;
      const searchVal = queryText.toLowerCase();

      const [members, chatMsgs, postsSnap, annsSnap, eventsSnap] = await Promise.all([
        searchGroupMembers(groupId, queryText.trim(), 20),
        searchGroupChatMessages(channelId, queryText.trim(), 20),
        getDocs(query(collection(db, 'posts'), where('groupId', '==', groupId), where('status', '==', 'active'), limit(50))),
        getDocs(query(collection(db, 'groups', groupId, 'announcements'), where('status', '==', 'active'), limit(50))),
        getDocs(query(collection(db, 'events'), where('groupId', '==', groupId), limit(50)))
      ]);

      setMemberResults(members);
      setChatResults(chatMsgs);

      // Filter posts and polls in-memory
      const matchedPosts = postsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Post))
        .filter((p) => p.title.toLowerCase().includes(searchVal) || p.content.toLowerCase().includes(searchVal));
      setPostResults(matchedPosts);

      // Filter announcements in-memory
      const matchedAnns = annsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as GroupAnnouncement))
        .filter((a) => a.title.toLowerCase().includes(searchVal) || a.content.toLowerCase().includes(searchVal));
      setAnnouncementResults(matchedAnns);

      // Filter events in-memory
      const matchedEvents = eventsSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as CampusEvent))
        .filter((ev) => ev.title.toLowerCase().includes(searchVal) || ev.description.toLowerCase().includes(searchVal));
      setEventResults(matchedEvents);

      setSearched(true);
    } catch (err) {
      console.error('Group search failed:', err);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Input Bar */}
      <form onSubmit={handleSearch} className="relative">
        <Search className="w-5 h-5 text-slate-500 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="Search posts, announcements, events, chat messages, and members in this group..."
          className="w-full bg-slate-900 border border-slate-800 rounded-3xl pl-12 pr-28 py-3.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500/50 shadow-xl"
        />
        <button
          type="submit"
          disabled={searching}
          className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-2xl transition-all"
        >
          {searching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
        </button>
      </form>

      {/* Results View */}
      {searched && (
        <div className="space-y-6">
          {/* Member Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-400" />
              <span>Matching Members ({memberResults.length})</span>
            </h3>

            {memberResults.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">No matching members found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {memberResults.map((m) => (
                  <div key={m.uid} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-xs">
                      {(m.displayName || 'U')[0]}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{m.displayName || 'Campus Student'}</h4>
                      <span className="text-[10px] text-slate-400 font-mono">Role: {m.role || 'Member'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Posts & Polls Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Matching Posts & Polls ({postResults.length})</span>
            </h3>

            {postResults.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">No matching posts or polls found.</p>
            ) : (
              <div className="space-y-3">
                {postResults.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </div>

          {/* Announcement Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <Megaphone className="w-4 h-4 text-amber-400" />
              <span>Matching Announcements ({announcementResults.length})</span>
            </h3>

            {announcementResults.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">No matching announcements found.</p>
            ) : (
              <div className="space-y-2">
                {announcementResults.map((ann) => (
                  <div key={ann.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-1">
                    <h4 className="font-bold text-white">{ann.title}</h4>
                    <p className="text-slate-300 leading-relaxed">{ann.content}</p>
                    <div className="text-[10px] text-slate-500 mt-1">
                      Posted by {ann.creatorName}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Event Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-rose-400" />
              <span>Matching Events ({eventResults.length})</span>
            </h3>

            {eventResults.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">No matching events found.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {eventResults.map((ev) => (
                  <div key={ev.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-1">
                    <h4 className="font-bold text-white">{ev.title}</h4>
                    <p className="text-slate-300 line-clamp-2">{ev.description}</p>
                    <div className="text-[10px] text-rose-400 font-mono mt-1">
                      Venue: {ev.location}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Chat Message Results */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Matching Chat Messages ({chatResults.length})</span>
            </h3>

            {chatResults.length === 0 ? (
              <p className="text-xs text-slate-500 italic pl-2">No matching chat messages found.</p>
            ) : (
              <div className="space-y-2">
                {chatResults.map((msg) => (
                  <div key={msg.id} className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sky-400">{msg.senderName || 'Student'}</span>
                    </div>
                    <p className="text-slate-300">{msg.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
