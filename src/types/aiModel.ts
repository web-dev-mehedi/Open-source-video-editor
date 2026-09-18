export type ModelTier = 'fast' | 'balanced' | 'ultra';

export type ModelInferenceBackend = 'webgpu' | 'directml' | 'cuda' | 'webgl' | 'wasm_simd' | 'cpu';

export type ModelDownloadStatus = 'not_installed' | 'downloading' | 'paused' | 'installed' | 'verifying' | 'corrupted' | 'error';

export interface AIModelPackage {
  id: string; // e.g. 'bg-remove-fast-v1'
  tier: ModelTier;
  name: string;
  architecture: string; // e.g. 'MobileNetV3-Lite' | 'MODNet-ResNet' | 'RobustVideoMatting'
  version: string;
  description: string;
  
  // Real verified storage and hardware metadata
  downloadSizeBytes: number; // e.g. 42 * 1024 * 1024
  diskSizeBytes: number; // e.g. 45 * 1024 * 1024
  vramRequirementMb: number; // e.g. 512, 1536, 4096
  ramRequirementMb: number; // e.g. 1024, 2048, 4096
  qualityRating: number; // 1 to 5 stars
  speedRating: number; // 1 to 5 stars
  recommendedHardware: string; // e.g. 'Integrated GPU / Any Multi-core CPU'
  supportedInputResolutions: string[]; // ['512x512', '1024x1024', '2048x2048']
  sha256Checksum: string;
  downloadUrl: string;

  // Runtime State
  status: ModelDownloadStatus;
  downloadProgressPercent: number;
  downloadedBytes: number;
  downloadSpeedBps?: number;
  error?: string;
  localPath?: string;
  installedAt?: string;
  isVerified?: boolean;
}

export interface HardwareInspectionResult {
  hasDedicatedGpu: boolean;
  gpuRenderer: string;
  gpuVendor: 'nvidia' | 'amd' | 'intel' | 'apple' | 'unknown';
  estimatedVramMb: number;
  systemRamMb: number;
  supportedBackends: ModelInferenceBackend[];
  recommendedBackend: ModelInferenceBackend;
  recommendedTier: ModelTier;
  recommendationReason: string;
}

export interface ModelDownloadProgressEvent {
  modelId: string;
  status: ModelDownloadStatus;
  progressPercent: number;
  downloadedBytes: number;
  totalBytes: number;
  speedBps?: number;
  error?: string;
}
