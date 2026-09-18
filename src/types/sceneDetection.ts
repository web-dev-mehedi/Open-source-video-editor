export interface DetectedSceneCut {
  id: string;
  timestamp: number; // Cut time in seconds relative to source video
  timelineTimestamp: number; // Time on timeline
  duration: number; // Duration of this scene in seconds
  confidence: number; // 0 to 1.0
  thumbnailUrl?: string;
}

export interface SceneDetectionOptions {
  sensitivity: 'low' | 'medium' | 'high';
  minSceneDurationSec: number; // Minimum length of a scene (default 0.8s)
  sampleIntervalSec: number; // How often to sample frames (default 0.25s)
}
