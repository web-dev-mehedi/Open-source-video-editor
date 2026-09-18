export interface TrackPoint {
  id: string;
  time: number; // Timeline time in seconds
  x: number; // Percentage 0 to 100
  y: number; // Percentage 0 to 100
  scale?: number; // 0.2 to 3.0
  rotation?: number; // -180 to 180 deg
}

export interface TrackedTarget {
  id: string;
  name: string;
  enabled: boolean;
  linkedType: 'caption' | 'overlay' | 'broll';
  linkedId: string;
  trackPoints: TrackPoint[];
  smoothing: number; // 0 to 100 (Gaussian trajectory smoothing)
  matchScale: boolean;
  matchRotation: boolean;
  offsetX: number; // Percentage offset from anchor
  offsetY: number;
}
