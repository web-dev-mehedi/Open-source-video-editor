export interface MulticamAngle {
  id: string;
  name: string; // e.g. 'Camera 1 (Wide)', 'Camera 2 (Close-up)', 'Camera 3 (Side)'
  clipId: string;
  filePath: string;
  thumbnailUrl?: string;
  syncOffsetSeconds: number; // Time offset to align with master
  audioEnabled: boolean;
  colorTag: string; // Badge color: '#EF4444' (Red), '#38BDF8' (Blue), '#10B981' (Green), '#F59E0B' (Amber)
}

export interface MulticamCutPoint {
  id: string;
  timecode: number;
  activeAngleId: string;
}

export interface MulticamSession {
  id: string;
  name: string;
  angles: MulticamAngle[];
  activeAngleId: string;
  audioMasterAngleId: string;
  syncMode: 'audio' | 'timecode' | 'manual';
  cutPoints: MulticamCutPoint[];
  isOpen: boolean;
}
