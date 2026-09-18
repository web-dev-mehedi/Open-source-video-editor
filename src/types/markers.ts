export type MarkerColor = 'red' | 'amber' | 'emerald' | 'cyan' | 'violet' | 'gray';
export type MarkerType = 'intro' | 'hook' | 'broll' | 'cta' | 'beat' | 'scene' | 'note' | 'custom';

export interface TimelineMarker {
  id: string;
  time: number; // seconds on timeline
  duration?: number; // optional range marker
  name: string;
  color: MarkerColor;
  type: MarkerType;
  note?: string;
  trackIndex?: number;
}
