import { collection, getDocs, query, limit, orderBy, where, collectionGroup } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { CampusEvent } from '../types';
import type { Opportunity } from '../types/opportunity';

export interface AssistantMessage {
  sender: 'user' | 'assistant';
  text: string;
  createdAt: Date;
}

/**
 * Heuristics-based local search assistant that strictly respects permissions & authorization.
 */
export const queryCampusAssistant = async (
  promptText: string,
  userId: string,
  userProfile: { departmentId?: string; batchYear?: number } | null
): Promise<string> => {
  const queryLower = promptText.toLowerCase();

  // Privacy Shield: Explicitly restrict access to DMs, chat messages, support tickets, and moderator resources
  const restrictedKeywords = ['dm', 'direct message', 'chat', 'moderator', 'report', 'audit log', 'admin dashboard', 'ticket', 'appeals'];
  const hasRestricted = restrictedKeywords.some((term) => queryLower.includes(term));
  if (hasRestricted) {
    return "Privacy Shield Enabled: The AI Assistant is not authorized to access private DMs, support desk tickets, or moderator records.";
  }

  try {
    // 1. DEADLINES / DUE DATE queries (e.g. "what deadlines are coming up?", "assignments", "due dates")
    if (queryLower.includes('deadline') || queryLower.includes('due') || queryLower.includes('assignment')) {
      // A. Get assignments
      const assignmentsRef = collection(db, 'users', userId, 'assignments');
      const assignmentsSnap = await getDocs(query(assignmentsRef, limit(10)));
      const assignments = assignmentsSnap.docs.map((d) => d.data());

      // B. Get opportunities
      const oppsRef = collection(db, 'opportunities');
      const oppsSnap = await getDocs(query(oppsRef, orderBy('createdAt', 'desc'), limit(15)));
      const rawOpps = oppsSnap.docs.map((d) => d.data() as Opportunity);
      const visibleOpps = rawOpps.filter((op) => {
        if (!userProfile?.departmentId) return true;
        if (op.branches && op.branches.length > 0) {
          return op.branches.some((b) => b.toLowerCase().includes(userProfile.departmentId!.toLowerCase()));
        }
        return true;
      });

      const lines: string[] = [];

      // Format assignments
      const activeAssignments = assignments.filter((a) => a.status !== 'completed' && a.deadline);
      if (activeAssignments.length > 0) {
        lines.push('📋 *Your Pending Course Assignments:*');
        activeAssignments.forEach((a) => {
          const dueTime = new Date(a.deadline).getTime();
          const daysLeft = Math.ceil((dueTime - Date.now()) / (1000 * 60 * 60 * 24));
          const dayStr = daysLeft > 0 ? `${daysLeft} days remaining` : daysLeft === 0 ? 'Due today' : 'Overdue';
          lines.push(`  • *${a.title}* - Subject: ${a.subjectCode || 'General'} (${dayStr})`);
        });
      }

      // Format opportunity deadlines
      const oppsWithDeadlines = visibleOpps.filter((o) => o.deadline);
      if (oppsWithDeadlines.length > 0) {
        if (lines.length > 0) lines.push('');
        lines.push('💼 *Upcoming Opportunity Deadlines:*');
        oppsWithDeadlines.slice(0, 5).forEach((o) => {
          let dueTime = 0;
          if (o.deadline?.toMillis) dueTime = o.deadline.toMillis();
          else if (o.deadline) dueTime = new Date(o.deadline).getTime();
          
          if (dueTime) {
            const daysLeft = Math.ceil((dueTime - Date.now()) / (1000 * 60 * 60 * 24));
            const dayStr = daysLeft > 0 ? `${daysLeft} days left` : 'Closed';
            lines.push(`  • *${o.title}* at ${o.organization || 'Partner'} (${dayStr})`);
          }
        });
      }

      if (lines.length === 0) {
        return "You have no upcoming assignments or active opportunities with deadlines listed.";
      }

      return `Here are the deadlines computed for your dashboard:\n\n${lines.join('\n')}`;
    }

    // 2. RSVP / REGISTRATION queries (e.g. "what events am I registered for?", "my rsvps")
    if (queryLower.includes('rsvp') || queryLower.includes('registered') || queryLower.includes('my event')) {
      const rsvpsQuery = query(
        collectionGroup(db, 'rsvps'),
        where('userId', '==', userId),
        where('status', '==', 'attending'),
        limit(10)
      );
      const rsvpsSnap = await getDocs(rsvpsQuery);
      const eventIds = rsvpsSnap.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean) as string[];

      if (eventIds.length === 0) {
        return "You are not currently registered to attend any upcoming campus events.";
      }

      const eventsRef = collection(db, 'events');
      const eventLines: string[] = [];

      for (const evId of eventIds) {
        const evSnap = await getDocs(query(eventsRef, where('__name__', '==', evId)));
        if (!evSnap.empty) {
          const ev = evSnap.docs[0].data() as CampusEvent;
          const dateStr = ev.eventDate?.toMillis 
            ? new Date(ev.eventDate.toMillis()).toLocaleDateString() 
            : 'TBD';
          eventLines.push(`• *${ev.title}* at ${ev.location} (${dateStr})`);
        }
      }

      return `Here are the events you are registered to attend:\n\n${eventLines.join('\n')}`;
    }

    // 3. SAVED ITEMS queries (e.g. "saved items", "saved opportunities", "show my saved")
    if (queryLower.includes('saved')) {
      // Retrieve saved listings / posts / opportunities
      const savedOppsRef = collection(db, 'users', userId, 'savedOpportunities');
      const snap = await getDocs(query(savedOppsRef, limit(10)));
      
      if (snap.empty) {
        return "You don't have any saved opportunities or bookmarks on your profile yet.";
      }

      const lines = snap.docs.map((d) => {
        const data = d.data();
        return `• *${data.title || 'Saved Opportunity'}* (${data.organization || 'Organization'})`;
      });

      return `Here are the opportunities saved to your profile:\n\n${lines.join('\n')}`;
    }

    // 4. Default: Original search fallback (Events / Internships / Study Notes keyword logic)
    if (queryLower.includes('event') || queryLower.includes('happening')) {
      const eventsRef = collection(db, 'events');
      const snap = await getDocs(query(eventsRef, orderBy('eventDate', 'asc'), limit(20)));
      const rawEvents = snap.docs.map((d) => ({ id: d.id, ...d.data() } as CampusEvent));

      const visibleEvents = rawEvents.filter((ev) => {
        if (!ev.visibility || ev.visibility === 'campus') return true;
        return false;
      });

      if (visibleEvents.length === 0) {
        return "I couldn't find any upcoming public events scheduled for your campus at the moment.";
      }

      const eventLines = visibleEvents.slice(0, 5).map(
        (ev) =>
          `• *${ev.title}* at ${ev.location} on ${
            ev.eventDate?.toMillis ? new Date(ev.eventDate.toMillis()).toLocaleDateString() : 'TBD'
          }`
      );
      return `Here are the upcoming events scheduled on campus:\n\n${eventLines.join('\n')}`;
    }

    if (queryLower.includes('intern') || queryLower.includes('job') || queryLower.includes('career') || queryLower.includes('opp')) {
      const oppsRef = collection(db, 'opportunities');
      const snap = await getDocs(query(oppsRef, orderBy('createdAt', 'desc'), limit(20)));
      const rawOpps = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Opportunity));

      const visibleOpps = rawOpps.filter((op) => {
        if (!userProfile?.departmentId) return true;
        if (op.branches && op.branches.length > 0) {
          return op.branches.some((b) => b.toLowerCase().includes(userProfile.departmentId!.toLowerCase()));
        }
        return true;
      });

      if (visibleOpps.length === 0) {
        return "There are no active internships or opportunities logged for your department currently.";
      }

      const oppLines = visibleOpps.slice(0, 5).map(
        (op) => `• *${op.title}* (${op.organization || 'Campus Partner'})`
      );
      return `Here are matching opportunities for your profile:\n\n${oppLines.join('\n')}`;
    }

    if (queryLower.includes('note') || queryLower.includes('material') || queryLower.includes('study')) {
      const subjectsRef = collection(db, 'subjects');
      const subsSnap = await getDocs(query(subjectsRef, limit(5)));
      const resources: { title: string; code: string }[] = [];

      for (const docSnap of subsSnap.docs) {
        const subData = docSnap.data();
        const resourcesColl = collection(db, 'subjects', docSnap.id, 'resources');
        const resSnap = await getDocs(query(resourcesColl, limit(3)));
        resSnap.docs.forEach((r) => {
          const rData = r.data();
          resources.push({ title: rData.title, code: subData.code });
        });
      }

      if (resources.length === 0) {
        return "I didn't find any shared study materials or notes on the academic hub yet.";
      }

      const noteLines = resources.slice(0, 5).map((r) => `• *${r.title}* [Subject: ${r.code}]`);
      return `Here are some active notes and lecture resources shared by peers:\n\n${noteLines.join('\n')}`;
    }

    // Default Fallback response
    return `Hello! I am your AI Campus Assistant. You can ask me queries about:
• Upcoming campus events ("Show events this week")
• Internships matching your profile ("Find CS internships")
• Lecture notes shared by peers ("Show study notes")
• Your upcoming deadlines ("What deadlines are coming up?")
• Registered events ("What events am I registered for?")
• Saved bookmarks ("Show my saved opportunities")

What can I assist you with today?`;
  } catch (err) {
    console.error('AI assistant query error:', err);
    return "I ran into a technical glitch processing your query. Please retry in a moment.";
  }
};
