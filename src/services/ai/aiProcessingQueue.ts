import { BackgroundMattingConfig } from '../../types/matting';
import { backgroundRemovalEngine } from './backgroundRemovalEngine';

export enum AIQueuePriority {
  HIGH = 3,   // Current playhead frame
  MEDIUM = 2, // Playback buffer
  LOW = 1,    // Background pre-cache
}

export interface AIProcessingTask {
  id: string;
  mediaId: string;
  sourceCanvas: HTMLCanvasElement;
  targetCanvas: HTMLCanvasElement;
  config: BackgroundMattingConfig;
  frameIndex: number;
  timestamp: number;
  lastModified: number | string;
  priority: AIQueuePriority;
  resolve?: (data: ImageData | null) => void;
  reject?: (err: any) => void;
}

export interface AIQueueStatus {
  isProcessing: boolean;
  isPaused: boolean;
  activeCount: number;
  queuedCount: number;
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
}

class AIProcessingQueueService {
  private queue: AIProcessingTask[] = [];
  private isProcessing = false;
  private isPaused = false;
  private currentFrame = 0;
  private totalFrames = 0;
  private listeners: Set<(status: AIQueueStatus) => void> = new Set();

  public enqueueFrame(task: Omit<AIProcessingTask, 'id'>): Promise<ImageData | null> {
    return new Promise((resolve, reject) => {
      const fullTask: AIProcessingTask = {
        ...task,
        id: `ai_task_${task.mediaId}_${task.frameIndex}_${Date.now()}`,
        resolve,
        reject,
      };

      // High priority items (scrubbing/playhead) jump directly to front of queue
      if (task.priority === AIQueuePriority.HIGH) {
        // Remove older pending tasks for same frame
        this.queue = this.queue.filter(
          (t) => !(t.mediaId === task.mediaId && t.frameIndex === task.frameIndex)
        );
        this.queue.unshift(fullTask);
      } else {
        this.queue.push(fullTask);
        this.queue.sort((a, b) => b.priority - a.priority);
      }

      this.totalFrames = Math.max(this.totalFrames, this.queue.length + this.currentFrame);
      this.notify();
      this.pump();
    });
  }

  private async pump() {
    if (this.isProcessing || this.isPaused || this.queue.length === 0) return;

    this.isProcessing = true;
    const task = this.queue.shift();

    if (!task) {
      this.isProcessing = false;
      return;
    }

    try {
      const result = await backgroundRemovalEngine.processFrame(
        task.sourceCanvas,
        task.targetCanvas,
        task.config,
        task.frameIndex,
        task.timestamp,
        task.mediaId,
        task.lastModified
      );
      this.currentFrame++;
      if (task.resolve) task.resolve(result);
    } catch (e) {
      if (task.reject) task.reject(e);
    } finally {
      this.isProcessing = false;
      this.notify();
      this.pump();
    }
  }

  public pause() {
    this.isPaused = true;
    this.notify();
  }

  public resume() {
    this.isPaused = false;
    this.notify();
    this.pump();
  }

  public cancelAll() {
    for (const t of this.queue) {
      if (t.resolve) t.resolve(null);
    }
    this.queue = [];
    this.isProcessing = false;
    this.isPaused = false;
    this.currentFrame = 0;
    this.totalFrames = 0;
    this.notify();
  }

  public subscribe(cb: (status: AIQueueStatus) => void): () => void {
    this.listeners.add(cb);
    cb(this.getStatus());
    return () => this.listeners.delete(cb);
  }

  private notify() {
    const s = this.getStatus();
    for (const cb of this.listeners) cb(s);
  }

  public getStatus(): AIQueueStatus {
    const total = Math.max(1, this.totalFrames);
    const pct = Math.min(100, Math.round((this.currentFrame / total) * 100));
    return {
      isProcessing: this.isProcessing,
      isPaused: this.isPaused,
      activeCount: this.isProcessing ? 1 : 0,
      queuedCount: this.queue.length,
      currentFrame: this.currentFrame,
      totalFrames: this.totalFrames,
      progressPercent: pct,
    };
  }
}

export const aiProcessingQueue = new AIProcessingQueueService();
