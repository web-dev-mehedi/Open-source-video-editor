export interface EditorCommand {
  id: string;
  title: string;
  keywords: string[];
  shortcut?: string;
  category: 'edit' | 'timeline' | 'clip' | 'caption' | 'export' | 'view' | 'marker' | 'tool';
  action: () => void;
  enabled?: () => boolean;
}

let registry: EditorCommand[] = [];

export function registerCommands(commands: EditorCommand[]) {
  for (const c of commands) {
    if (!registry.find((r) => r.id === c.id)) registry.push(c);
  }
}
export function getCommands(): EditorCommand[] { return [...registry]; }
export function clearCommands() { registry = []; }
export function searchCommands(q: string): EditorCommand[] {
  const s = q.trim().toLowerCase();
  if (!s) return registry.slice(0, 12);
  return registry.filter((c) => `${c.title} ${c.keywords.join(' ')}`.toLowerCase().includes(s)).slice(0, 20);
}
