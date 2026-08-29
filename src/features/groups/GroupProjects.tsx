import React, { useEffect, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  createGroupProject,
  getGroupProjects,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  getProjectTasks,
  type GroupProject,
  type ProjectTask
} from '../../services/groupProjectService';
import {
  FolderKanban,
  Plus,
  Trash2,
  CheckCircle2,
  Play,
  RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';

interface GroupProjectsProps {
  groupId: string;
}

export const GroupProjects: React.FC<GroupProjectsProps> = ({ groupId }) => {
  const { currentUser, userProfile } = useAuth();
  const [projects, setProjects] = useState<GroupProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<GroupProject | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Project Form
  const [showAddProject, setShowAddProject] = useState(false);
  const [pName, setPName] = useState('');
  const [pDesc, setPDesc] = useState('');

  // New Task Form
  const [showAddTask, setShowAddTask] = useState(false);
  const [tTitle, setTTitle] = useState('');
  const [tDesc, setTDesc] = useState('');
  const [tPriority, setTPriority] = useState<'low' | 'normal' | 'high'>('normal');

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const data = await getGroupProjects(groupId);
      setProjects(data);
      if (data.length > 0 && !selectedProject) {
        setSelectedProject(data[0]);
      }
    } catch {
      toast.error('Failed to load group projects.');
    } finally {
      setLoading(false);
    }
  };

  const fetchTasks = async (pId: string) => {
    try {
      const data = await getProjectTasks(pId);
      setTasks(data);
    } catch {
      toast.error('Failed to load project tasks.');
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [groupId]);

  useEffect(() => {
    if (selectedProject?.id) {
      fetchTasks(selectedProject.id);
    }
  }, [selectedProject]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !pName) return;

    try {
      await createGroupProject(groupId, currentUser.uid, pName, pDesc);
      toast.success('Workspace created successfully.');
      setPName('');
      setPDesc('');
      setShowAddProject(false);
      fetchProjects();
    } catch {
      toast.error('Failed to create project.');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject?.id || !tTitle) return;

    try {
      await createProjectTask(selectedProject.id, {
        title: tTitle,
        description: tDesc,
        status: 'todo',
        priority: tPriority,
      });
      toast.success('Task created.');
      setTTitle('');
      setTDesc('');
      setShowAddTask(false);
      fetchTasks(selectedProject.id);
    } catch {
      toast.error('Failed to add task.');
    }
  };

  const handleTaskStatus = async (task: ProjectTask, newStatus: 'todo' | 'in_progress' | 'completed') => {
    if (!selectedProject?.id || !task.id || !currentUser) return;
    try {
      const displayName = userProfile?.displayName || currentUser.email || 'Group Member';
      await updateProjectTask(
        groupId,
        selectedProject.id,
        task.id,
        { ...task, status: newStatus },
        currentUser.uid,
        displayName
      );
      toast.success(newStatus === 'completed' ? 'Task completed! +15 Points awarded.' : 'Task status updated.');
      fetchTasks(selectedProject.id);
    } catch {
      toast.error('Failed to update task.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!selectedProject?.id) return;
    try {
      await deleteProjectTask(selectedProject.id, taskId);
      toast.success('Task deleted.');
      fetchTasks(selectedProject.id);
    } catch {
      toast.error('Failed to delete task.');
    }
  };

  if (loading) {
    return <p className="text-xs text-slate-500 italic text-center py-8">Loading collaborative workspaces...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Top action toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-850 pb-3">
        <div className="space-y-0.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-indigo-400" />
            <span>Project Workspaces ({projects.length})</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono">Sprint tracking & collaborative tasks</p>
        </div>

        <button
          onClick={() => setShowAddProject(!showAddProject)}
          className="px-3 py-1.5 bg-indigo-500 text-slate-950 text-xs font-black uppercase rounded-xl flex items-center gap-1 hover:bg-indigo-400 transition-all self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Project</span>
        </button>
      </div>

      {/* New Project Dialog */}
      {showAddProject && (
        <form onSubmit={handleAddProject} className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 max-w-md">
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Project Name</label>
            <input
              type="text"
              required
              value={pName}
              onChange={(e) => setPName(e.target.value)}
              placeholder="e.g. Website Overhaul Sprint"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Description</label>
            <textarea
              value={pDesc}
              onChange={(e) => setPDesc(e.target.value)}
              placeholder="A brief description of goals and scope..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none h-16 resize-none"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 bg-indigo-500 text-slate-950 text-[10px] font-black uppercase rounded-lg"
            >
              Create Workspace
            </button>
            <button
              type="button"
              onClick={() => setShowAddProject(false)}
              className="px-3 py-1.5 bg-slate-950 text-slate-500 text-[10px] font-black uppercase rounded-lg"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Workspace selector tabs */}
      {projects.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-850">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedProject(p)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border shrink-0 ${
                selectedProject?.id === p.id
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'bg-slate-950 text-slate-500 border-slate-900 hover:text-white'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Selected Project Tasks Board */}
      {selectedProject && (
        <div className="space-y-6">
          <div className="flex justify-between items-center bg-slate-900/60 p-4 border border-slate-850 rounded-2xl">
            <div className="space-y-0.5">
              <h4 className="text-xs font-bold text-white uppercase font-mono">{selectedProject.name}</h4>
              <p className="text-[10px] text-slate-400">{selectedProject.description || 'No description provided.'}</p>
            </div>
            <button
              onClick={() => setShowAddTask(!showAddTask)}
              className="px-2.5 py-1.5 bg-indigo-500/10 hover:bg-indigo-500 border border-indigo-500/20 text-indigo-400 hover:text-slate-950 text-[10px] font-black uppercase rounded-lg transition-all"
            >
              Add Task
            </button>
          </div>

          {/* Add Task Form */}
          {showAddTask && (
            <form onSubmit={handleAddTask} className="p-4 bg-slate-900 border border-slate-850 rounded-2xl space-y-3 max-w-sm">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Task Title</label>
                <input
                  type="text"
                  required
                  value={tTitle}
                  onChange={(e) => setTTitle(e.target.value)}
                  placeholder="e.g. Design Landing Page layout"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Description</label>
                <textarea
                  value={tDesc}
                  onChange={(e) => setTDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none h-14 resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold text-slate-400 font-mono">Priority</label>
                <select
                  value={tPriority}
                  onChange={(e: any) => setTPriority(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-850 rounded-xl text-xs focus:outline-none text-slate-350"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="px-4 py-1.5 bg-indigo-500 text-slate-950 text-[10px] font-black uppercase rounded-lg">
                  Save Task
                </button>
                <button type="button" onClick={() => setShowAddTask(false)} className="px-3 py-1.5 bg-slate-950 text-slate-500 text-[10px] font-black uppercase rounded-lg">
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Kanban Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Columns: Todo, In Progress, Completed */}
            {(['todo', 'in_progress', 'completed'] as const).map((col) => {
              const colTasks = tasks.filter((t) => t.status === col);
              const colLabel = col === 'todo' ? 'To Do' : col === 'in_progress' ? 'In Progress' : 'Completed';
              const colHeaderColor = col === 'todo' ? 'text-slate-450' : col === 'in_progress' ? 'text-amber-400' : 'text-emerald-400';

              return (
                <div key={col} className="p-4 bg-slate-900 border border-slate-850 rounded-3xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <span className={`text-[10px] font-black uppercase font-mono ${colHeaderColor}`}>{colLabel}</span>
                    <span className="text-[9px] font-mono text-slate-500 bg-slate-950 px-2 py-0.5 rounded-full">{colTasks.length}</span>
                  </div>

                  <div className="space-y-3.5 max-h-[400px] overflow-y-auto scrollbar-none">
                    {colTasks.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic text-center py-6">No tasks in this column.</p>
                    ) : (
                      colTasks.map((task) => (
                        <div key={task.id} className="p-4 bg-slate-950 border border-slate-850 rounded-2xl space-y-3 hover:border-slate-800 transition-all">
                          <div className="space-y-1 min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <p className={`text-xs font-bold text-white truncate ${col === 'completed' ? 'line-through text-slate-500' : ''}`}>
                                {task.title}
                              </p>
                              <span className={`text-[8px] px-1.5 py-0.2 border rounded font-black uppercase font-mono ${
                                task.priority === 'high' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-slate-900 text-slate-400'
                              }`}>
                                {task.priority}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 line-clamp-2">{task.description}</p>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-850 pt-2.5">
                            {/* Actions to move tasks */}
                            <div className="flex items-center gap-1.5">
                              {col !== 'todo' && (
                                <button
                                  onClick={() => handleTaskStatus(task, 'todo')}
                                  title="Move to Todo"
                                  className="p-1 hover:text-slate-300 text-slate-600 transition-all"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {col !== 'in_progress' && col !== 'completed' && (
                                <button
                                  onClick={() => handleTaskStatus(task, 'in_progress')}
                                  title="Start Task"
                                  className="p-1 hover:text-amber-400 text-slate-600 transition-all"
                                >
                                  <Play className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {col !== 'completed' && (
                                <button
                                  onClick={() => handleTaskStatus(task, 'completed')}
                                  title="Complete Task"
                                  className="p-1 hover:text-emerald-450 text-slate-600 transition-all"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() => task.id && handleDeleteTask(task.id)}
                              className="p-1 hover:text-rose-500 text-slate-600 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
