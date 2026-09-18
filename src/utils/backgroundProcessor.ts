export type BgTaskStatus = 'queued' | 'running' | 'done' | 'error';
export interface BgTask {
  id: string;
  label: string;
  status: BgTaskStatus;
  progress: number; // 0-100
  error?: string;
}
type Listener = (tasks: BgTask[]) => void;

let tasks: BgTask[] = [];
let listeners: Listener[] = [];

export function getBgTasks() { return [...tasks]; }
export function subscribeBgTasks(fn: Listener) { listeners.push(fn); return () => { listeners = listeners.filter((l) => l !== fn); }; }
function notify() { listeners.forEach((l) => l([...tasks])); }

export async function runBackgroundTask(label: string, fn: (update: (p: number) => void) => Promise<void>): Promise<string> {
  const id = `bg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const task: BgTask = { id, label, status: 'queued', progress: 0 };
  tasks = [...tasks.slice(-19), task];
  notify();
  tasks = tasks.map((t) => t.id === id ? { ...t, status: 'running' } : t);
  notify();
  try {
    await fn((p) => {
      tasks = tasks.map((t) => t.id === id ? { ...t, progress: Math.max(0, Math.min(100, Math.round(p))) } : t);
      notify();
    });
    tasks = tasks.map((t) => t.id === id ? { ...t, status: 'done', progress: 100 } : t);
  } catch (e: any) {
    tasks = tasks.map((t) => t.id === id ? { ...t, status: 'error', error: e?.message || 'Failed' } : t);
  }
  notify();
  setTimeout(() => { tasks = tasks.filter((t) => t.id !== id); notify(); }, 4000);
  return id;
}
