import { useState, useMemo, useCallback } from 'react';
import { useStore } from '../../services/store';
import { FEATURE_DEFINITIONS } from '../../config';
import EmptyWorkspace from '../../components/ui/EmptyWorkspace';
import type { ActionTask, TaskPriority, TaskStatus } from '../../types';
import {
  Plus, Check, RotateCcw, Trash2, Filter, Edit3, X,
  ChevronDown, ChevronUp, ListChecks
} from 'lucide-react';
import './PlanPage.css';
import { useInterviewWorkspace } from '../../services/InterviewWorkspace';

export default function PlanPage() {
  const { report } = useInterviewWorkspace();
  const hasTask = useStore((s) => s.hasTask);
  const latestAssessment = useStore((s) => s.getLatestAssessment());
  const tasks = useStore((s) => s.tasks);
  const addTask = useStore((s) => s.addTask);
  const updateTask = useStore((s) => s.updateTask);
  const deleteTask = useStore((s) => s.deleteTask);

  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New task form state
  const [newTask, setNewTask] = useState({
    title: '',
    rationale: '',
    priority: 'medium' as TaskPriority,
    effort: 'medium' as 'small' | 'medium' | 'large',
    feature: '',
    targetDate: '',
  });

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    if (filter === 'pending') result = result.filter((t) => t.status !== 'completed');
    if (filter === 'completed') result = result.filter((t) => t.status === 'completed');
    if (priorityFilter !== 'all') result = result.filter((t) => t.priority === priorityFilter);
    return result;
  }, [tasks, filter, priorityFilter]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, typeof filteredTasks> = {};
    for (const t of filteredTasks) {
      const key = t.category || 'General';
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    }
    return groups;
  }, [filteredTasks]);

  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter((t) => t.status === 'completed').length,
    pending: tasks.filter((t) => t.status !== 'completed').length,
  }), [tasks]);

  const handleAddTask = useCallback(() => {
    if (!newTask.title.trim()) return;
    addTask({
      title: newTask.title,
      rationale: newTask.rationale,
      priority: newTask.priority,
      effort: newTask.effort,
      feature: newTask.feature,
      category: newTask.feature
        ? (FEATURE_DEFINITIONS.find((f) => f.key === newTask.feature)?.category ?? 'general')
        : 'general',
      targetDate: newTask.targetDate || undefined,
    });
    setNewTask({ title: '', rationale: '', priority: 'medium', effort: 'medium', feature: '', targetDate: '' });
    setShowAddForm(false);
  }, [newTask, addTask]);

  const toggleStatus = useCallback(
    (task: ActionTask) => {
      updateTask(task.id, {
        status: task.status === 'completed' ? 'pending' : 'completed',
      });
    },
    [updateTask]
  );

  const priorityColors: Record<TaskPriority, string> = {
    high: 'var(--color-error)',
    medium: 'var(--color-warning)',
    low: 'var(--color-text-tertiary)',
  };

  return (
    <div className="plan-page">
      {report && <section className="interview-plan-intro"><span className="workspace-kicker">FROM YOUR INTERVIEW</span><h2>Build on what you demonstrated.</h2><p>These recommendations come from the missing evidence in your saved {report.selectedDomain} interview.</p><div className="interview-plan-suggestions">{report.improvementTasks.map((task) => {
        const feature = `interview:${report.id}`;
        const added = hasTask(feature, task.title);
        return <article key={task.id}><div><h3>{task.title}</h3><p>{task.action}</p></div><button className="btn btn-secondary" disabled={added} onClick={() => addTask({ title: task.title, rationale: task.action, priority: task.priority === 'high' ? 'high' : 'medium', effort: 'medium', feature, category: 'interview' })}>{added ? 'Added to plan' : 'Add to plan'}{added ? <Check size={14}/> : <Plus size={14}/>}</button></article>;
      })}</div></section>}
      {/* Stats bar */}
      <div className="plan-stats">
        <div className="plan-stat">
          <span className="plan-stat-value font-mono">{stats.total}</span>
          <span className="plan-stat-label">Total tasks</span>
        </div>
        <div className="plan-stat">
          <span className="plan-stat-value font-mono" style={{ color: 'var(--color-success)' }}>
            {stats.completed}
          </span>
          <span className="plan-stat-label">Completed</span>
        </div>
        <div className="plan-stat">
          <span className="plan-stat-value font-mono">{stats.pending}</span>
          <span className="plan-stat-label">Pending</span>
        </div>
        {stats.total > 0 && (
          <div className="plan-stat">
            <span className="plan-stat-value font-mono">
              {Math.round((stats.completed / stats.total) * 100)}%
            </span>
            <span className="plan-stat-label">Completion</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="plan-toolbar">
        <div className="plan-filters">
          <select
            className="form-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            style={{ width: 140 }}
            aria-label="Status filter"
          >
            <option value="all">All tasks</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
          </select>
          <select
            className="form-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as typeof priorityFilter)}
            style={{ width: 140 }}
            aria-label="Priority filter"
          >
            <option value="all">All priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(true)}>
          <Plus size={14} />
          Add task
        </button>
      </div>

      {/* Add task form */}
      {showAddForm && (
        <div className="card plan-add-form">
          <div className="card-header">
            <h3 className="card-title">New task</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowAddForm(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="plan-form-grid">
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Title <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={newTask.title}
                onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g., Complete two timed array practice sessions"
              />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Rationale</label>
              <input
                type="text"
                className="form-input"
                value={newTask.rationale}
                onChange={(e) => setNewTask((p) => ({ ...p, rationale: e.target.value }))}
                placeholder="Why this task matters"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                value={newTask.priority}
                onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Effort</label>
              <select
                className="form-select"
                value={newTask.effort}
                onChange={(e) => setNewTask((p) => ({ ...p, effort: e.target.value as 'small' | 'medium' | 'large' }))}
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target date</label>
              <input
                type="date"
                className="form-input"
                value={newTask.targetDate}
                onChange={(e) => setNewTask((p) => ({ ...p, targetDate: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Related skill</label>
              <select
                className="form-select"
                value={newTask.feature}
                onChange={(e) => setNewTask((p) => ({ ...p, feature: e.target.value }))}
              >
                <option value="">None</option>
                {FEATURE_DEFINITIONS.filter((f) => f.type === 'number').map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddTask} disabled={!newTask.title.trim()}>
              Add task
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {filteredTasks.length === 0 ? (
        <div className="empty-state" style={{ paddingTop: 48 }}>
          <ListChecks size={48} className="text-tertiary" style={{ opacity: 0.3 }} />
          <h3>No tasks yet</h3>
          <p>
            {tasks.length === 0
              ? 'Add tasks manually or generate them from Skill Analysis.'
              : 'No tasks match the current filters.'}
          </p>
        </div>
      ) : (
        Object.entries(groupedTasks).map(([category, catTasks]) => (
          <div key={category} className="plan-group">
            <h3 className="plan-group-title">{category}</h3>
            <div className="plan-task-list">
              {catTasks.map((task) => (
                <div key={task.id} className={`plan-task ${task.status === 'completed' ? 'completed' : ''}`}>
                  <button
                    className="plan-task-check"
                    onClick={() => toggleStatus(task)}
                    aria-label={task.status === 'completed' ? 'Reopen task' : 'Complete task'}
                    style={{
                      borderColor: task.status === 'completed' ? 'var(--color-success)' : 'var(--color-border)',
                      background: task.status === 'completed' ? 'var(--color-success)' : 'transparent',
                    }}
                  >
                    {task.status === 'completed' && <Check size={12} color="white" />}
                  </button>
                  <div className="plan-task-content">
                    <div className="plan-task-title">{task.title}</div>
                    {task.rationale && (
                      <div className="plan-task-rationale text-secondary">{task.rationale}</div>
                    )}
                    <div className="plan-task-meta font-mono">
                      <span
                        className="plan-task-priority"
                        style={{ color: priorityColors[task.priority] }}
                      >
                        {task.priority}
                      </span>
                      <span>{task.effort} effort</span>
                      {task.targetDate && <span>Due: {task.targetDate}</span>}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm plan-task-delete"
                    onClick={() => deleteTask(task.id)}
                    aria-label="Delete task"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
