/**
 * NLE Drag-and-Drop payload bus — one writer + one reader for every
 * drag surface (library panels, media pool, timeline tracks, preview).
 *
 * BUG FIX: dataTransfer.getData is unreliable during dragover in some
 * browsers, and several panels only wrote dataTransfer (no fallback), so
 * ghost previews / track validation saw "no payload" and drops silently
 * did nothing. Every writer below stores to BOTH dataTransfer AND a
 * window-scoped slot; every reader checks dataTransfer first, then the
 * slot. Drop handlers MUST call clearDragPayload() after consuming.
 */

export type NleDragType =
  | 'footage'
  | 'audio'
  | 'effect'
  | 'filter'
  | 'transition'
  | 'text-preset'
  | 'element-preset'
  | 'motion-graphic'
  | 'overlay-image'
  | 'clip-move';

export interface NleDragPayload {
  type: NleDragType;
  /** Library preset id (effect / filter / transition / text / element). */
  presetId?: string;
  effectType?: string;
  transitionType?: string;
  filterId?: string;
  name?: string;
  params?: Record<string, any>;
  duration?: number;
  clip?: any;
  preset?: any;
  item?: any;
  template?: any;
  [k: string]: any;
}

const SLOT = '__cf_draggedMedia';

export function setDragPayload(e: React.DragEvent, payload: NleDragPayload): void {
  try {
    const raw = JSON.stringify(payload);
    e.dataTransfer.setData('application/json', raw);
    e.dataTransfer.setData('text/plain', raw);
  } catch { /* clipboard may be locked — window slot still works */ }
  try {
    e.dataTransfer.effectAllowed = 'copy';
  } catch { /* noop */ }
  try {
    (window as any)[SLOT] = payload;
  } catch { /* noop */ }
}

export function getDragPayload(e?: React.DragEvent | null): NleDragPayload | null {
  if (e) {
    try {
      const raw = e.dataTransfer.getData('application/json') || e.dataTransfer.getData('text/plain');
      if (raw) return JSON.parse(raw) as NleDragPayload;
    } catch { /* fall through to slot */ }
  }
  try {
    const slot = (window as any)[SLOT];
    if (slot && typeof slot === 'object') return slot as NleDragPayload;
  } catch { /* noop */ }
  return null;
}

export function peekDragPayload(): NleDragPayload | null {
  try {
    const slot = (window as any)[SLOT];
    if (slot && typeof slot === 'object') return slot as NleDragPayload;
  } catch { /* noop */ }
  return null;
}

export function clearDragPayload(): void {
  try {
    (window as any)[SLOT] = null;
  } catch { /* noop */ }
}
