import React, { useEffect, useState } from 'react';
import type { GroupTask } from '../../types/groupTask';
import { useAuth } from '../../hooks/useAuth';
import {
  getGroupTasks,
  createGroupTask,
  updateGroupTask,
  deleteGroupTask,
} from '../../services/groupTaskService';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import toast from 'react-hot-toast';
import {
  User,
  Plus,
  Trash2,
  Calendar,
  FolderLock,
  ListTodo,
  X
} from 'lucide-react';

interface GroupTasksProps {
  groupId: string;
  isMember: boolean;
}

export const GroupTasks: React.FC<GroupTasksProps> = ({ groupId, isMember }) => {
  const { currentUser, userProfile } = useAuth();
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [groupMembers, setGroupMembers] = useState<{ uid: string; displayName: string }[]>([]);

  // Task Creation Form State
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [dueDate, setDueDate] = useState<string>('');

  useEffect(() => {
    if (!groupId) return;
    const fetchTasks = async () => {
      setLoading(true);
      const list = await getGroupTasks(groupId);
      setTasks(list);
      setLoading(false);
    };
    fetchTasks();
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !isMember) return;
    const fetchMembers = async () => {
      try {
        const membersRef = collection(db, 'groups', groupId, 'members');
        const snap = await getDocs(membersRef);
        const membersList: { uid: string; displayName: string }[] = [];
        for (const docSnap of snap.docs) {
          const userRef = doc(db, 'users', docSnap.id);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            membersList.push({
              uid: docSnap.id,
              displayName: userSnap.data().displayName || 'Student',
            });
          }
        }
        setGroupMembers(membersList);
      } catch (err) {
        console.error('Failed to load group members for task assignment:', err);
      }
    };
    fetchMembers();
  }, [groupId, isMember]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !title.trim()) return;

    try {
      const selectedMember = groupMembers.find((m) => m.uid === assignedTo);
      const newTask = await createGroupTask(
        {
          groupId,
          title: title.trim(),
          description: description.trim(),
          assignedTo: assignedTo || undefined,
          assignedToName: selectedMember?.displayName || undefined,
          status: 'todo',
          priority,
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
        currentUser,
        userProfile?.displayName || currentUser.displayName || 'Campus Member'
      );

      setTasks((prev) => [newTask, ...prev]);
      setShowCreateModal(false);
      setTitle('');
      setDescription('');
      setAssignedTo('');
      setPriority('medium');
      setDueDate('');
      toast.success('Group task created!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to create task.');
    }
  };

  const handleStatusChange = async (taskId: string, nextStatus: 'todo' | 'in_progress' | 'completed') => {
    if (!currentUser) return;
    try {
      await updateGroupTask(
        groupId,
        taskId,
        { status: nextStatus },
        currentUser,
        userProfile?.displayName || currentUser.displayName || 'Campus Member'
      );
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
      );
      toast.success(`Task status updated to ${nextStatus}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update task status.');
    }
  };

  const handleDelete = async (taskId: string) => {
    if (!currentUser) return;
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteGroupTask(groupId, taskId, currentUser);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success('Task deleted successfully.');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete task.');
    }
  };

  // Render board columns
  const getColTasks = (colStatus: 'todo' | 'in_progress' | 'completed') => {
    return tasks.filter((t) => t.status === colStatus);
  };

  return (
    <div className="space-y-4">
      {/* Header Panel */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <ListTodo className="w-4 h-4 text-sky-400" />
          <span>Collaborative Tasks</span>
        </h3>

        {isMember && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Task</span>
          </button>
        )}
      </div>

      {!isMember && (
        <div className="p-8 bg-slate-900/40 border border-slate-800 rounded-3xl text-center space-y-2">
          <FolderLock className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400 italic">Group tasks are only available to members.</p>
        </div>
      )}

      {isMember && (
        <div>
          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading tasks...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* TO DO COLUMN */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider">To Do</span>
                  <span className="px-2 py-0.5 bg-slate-900 rounded-full text-[10px] text-slate-400 font-bold">
                    {getColTasks('todo').length}
                  </span>
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {getColTasks('todo').length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-600 italic">No tasks.</div>
                  ) : (
                    getColTasks('todo').map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* IN PROGRESS COLUMN */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-xs font-black text-sky-400 uppercase tracking-wider">In Progress</span>
                  <span className="px-2 py-0.5 bg-sky-950 text-sky-400 rounded-full text-[10px] font-bold">
                    {getColTasks('in_progress').length}
                  </span>
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {getColTasks('in_progress').length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-600 italic">No tasks.</div>
                  ) : (
                    getColTasks('in_progress').map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>

              {/* COMPLETED COLUMN */}
              <div className="bg-slate-950/40 border border-slate-900 rounded-3xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                  <span className="text-xs font-black text-emerald-400 uppercase tracking-wider">Completed</span>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 rounded-full text-[10px] font-bold">
                    {getColTasks('completed').length}
                  </span>
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {getColTasks('completed').length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-slate-600 italic">No tasks.</div>
                  ) : (
                    getColTasks('completed').map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={handleStatusChange}
                        onDelete={handleDelete}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setShowCreateModal(false)} />
          <form onSubmit={handleCreate} className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 z-10 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-sky-400" />
                <span>Add Collaborative Task</span>
              </h3>
              <button type="button" onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Build landing page draft"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Outline task details or requirements..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Assignee</label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Unassigned</option>
                    {groupMembers.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1 font-mono">Due Date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-sky-500/10 transition-all"
            >
              Create Task
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

/* Mini Task Card Component */
interface TaskCardProps {
  task: GroupTask;
  onStatusChange: (taskId: string, nextStatus: 'todo' | 'in_progress' | 'completed') => void;
  onDelete: (taskId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onStatusChange, onDelete }) => {
  const priorityColors = {
    low: 'bg-slate-900 border-slate-800 text-slate-400',
    medium: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    high: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  };

  return (
    <div className="p-4 bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-2.5 transition-all shadow-md">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-xs font-bold text-white leading-tight break-words">{task.title}</h4>
        <button
          onClick={() => onDelete(task.id!)}
          className="text-slate-500 hover:text-rose-400 p-0.5 shrink-0"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {task.description && (
        <p className="text-[11px] text-slate-400 line-clamp-3 leading-relaxed break-words">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={`px-2 py-0.5 border rounded-full text-[9px] font-black uppercase ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>

        {task.assignedToName ? (
          <div className="flex items-center gap-1 text-[10px] text-slate-300 font-medium">
            <User className="w-3 h-3 text-sky-400" />
            <span className="truncate max-w-[80px]">{task.assignedToName}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-[10px] text-slate-500 italic">
            <span>Unassigned</span>
          </div>
        )}
      </div>

      {task.dueDate && (
        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono">
          <Calendar className="w-3 h-3 text-slate-500" />
          <span>{new Date(task.dueDate.toDate ? task.dueDate.toDate() : task.dueDate).toLocaleDateString()}</span>
        </div>
      )}

      {/* Status Transition Select */}
      <div className="pt-2 border-t border-slate-950 flex items-center gap-2">
        <span className="text-[10px] text-slate-500">Status:</span>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id!, e.target.value as any)}
          className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-sky-500"
        >
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </div>
  );
};
