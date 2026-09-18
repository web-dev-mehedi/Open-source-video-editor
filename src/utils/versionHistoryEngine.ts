export interface VersionSnapshot {
  id: string;
  createdAt: string;
  name: string;
  projectJson: any;
  sizeBytes: number;
}

const LS_KEY = 'cf_version_history';
const MAX_VERSIONS = 20;

export function loadVersions(projectId: string): VersionSnapshot[] {
  try {
    const raw = localStorage.getItem(`${LS_KEY}_${projectId}`);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function saveVersion(projectId: string, name: string, projectJson: any) {
  const list = loadVersions(projectId);
  const snap: VersionSnapshot = {
    id: `ver_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
    name,
    projectJson: JSON.parse(JSON.stringify(projectJson)),
    sizeBytes: JSON.stringify(projectJson).length,
  };
  const next = [snap, ...list].slice(0, MAX_VERSIONS);
  try { localStorage.setItem(`${LS_KEY}_${projectId}`, JSON.stringify(next)); } catch {}
  return next;
}
export function saveAutoSave(projectId: string, projectJson: any) {
  try { localStorage.setItem(`cf_autosave_${projectId}`, JSON.stringify({ t: Date.now(), p: projectJson })); } catch {}
}
export function loadAutoSave(projectId: string): any | null {
  try {
    const raw = localStorage.getItem(`cf_autosave_${projectId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > 1000 * 60 * 60 * 24 * 3) return null;
    return parsed.p;
  } catch { return null; }
}
