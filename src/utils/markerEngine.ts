import { TimelineMarker, MarkerColor, MarkerType } from '../types/markers';

export function createMarker(time: number, opts: Partial<Omit<TimelineMarker, 'id' | 'time'>> = {}): TimelineMarker {
  return {
    id: `mk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    time: Math.max(0, Math.round(time * 100) / 100),
    duration: opts.duration,
    name: opts.name || 'Marker',
    color: opts.color || 'cyan',
    type: opts.type || 'custom',
    note: opts.note,
    trackIndex: opts.trackIndex,
  };
}

export function generateAutoMarkersFromClips(
  clips: { timelineStart: number; timelineDuration: number; name: string }[],
  captions: { start: number; end: number; text: string }[] = []
): TimelineMarker[] {
  const markers: TimelineMarker[] = [];
  for (const c of clips) {
    markers.push(createMarker(c.timelineStart, { name: `Start: ${c.name.slice(0, 18)}`, color: 'cyan', type: 'scene' }));
    markers.push(createMarker(c.timelineStart + c.timelineDuration, { name: `End: ${c.name.slice(0, 18)}`, color: 'gray', type: 'scene' }));
  }
  for (const cap of captions.slice(0, 20)) {
    markers.push(createMarker(cap.start, { name: `Cap: ${cap.text.slice(0, 20)}`, color: 'violet', type: 'note' }));
  }
  return markers.sort((a, b) => a.time - b.time).slice(0, 80);
}

export function generateBeatMarkers(peaks: number[], duration: number): TimelineMarker[] {
  if (!peaks || peaks.length === 0) return [];
  const markers: TimelineMarker[] = [];
  const secPerPeak = duration / peaks.length;
  for (let i = 1; i < peaks.length - 1; i++) {
    if (peaks[i] > 0.55 && peaks[i] > peaks[i - 1] && peaks[i] > peaks[i + 1]) {
      markers.push(createMarker(i * secPerPeak, { name: 'Beat', color: 'amber', type: 'beat' }));
    }
  }
  return markers.slice(0, 60);
}
