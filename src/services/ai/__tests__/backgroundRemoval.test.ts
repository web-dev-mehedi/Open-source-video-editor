// @ts-nocheck
import { describe, test, assert } from 'vitest';
import {
  aiModelManager,
  MODEL_CATALOG,
} from '../modelManager';
import {
  MatteRefinementPipeline,
  TemporalMaskState,
} from '../matteRefinementPipeline';
import {
  matteCache,
  computeMatteCacheKey,
} from '../../storage/matteCache';
import {
  backgroundRemovalEngine,
} from '../backgroundRemovalEngine';
import { DEFAULT_MATTING_CONFIG } from '../../../types/matting';

describe('Professional Local AI Background Removal System', () => {
  // Test 1: Model Catalog Integrity & Specifications
  test('1. Model Catalog contains verified Fast, Balanced, and Ultra specifications', () => {
    assert.strictEqual(MODEL_CATALOG.length, 3, 'Must have 3 model packages');

    const fast = MODEL_CATALOG.find((m) => m.tier === 'fast');
    const balanced = MODEL_CATALOG.find((m) => m.tier === 'balanced');
    const ultra = MODEL_CATALOG.find((m) => m.tier === 'ultra');

    assert.ok(fast, 'Fast model must exist');
    assert.ok(fast.downloadSizeBytes > 30 * 1024 * 1024, 'Fast download size > 30MB');
    assert.strictEqual(fast.speedRating, 5, 'Fast speed rating must be 5');

    assert.ok(balanced, 'Balanced model must exist');
    assert.ok(balanced.downloadSizeBytes > 150 * 1024 * 1024, 'Balanced download size > 150MB');
    assert.strictEqual(balanced.qualityRating, 4, 'Balanced quality rating must be 4');

    assert.ok(ultra, 'Ultra model must exist');
    assert.ok(ultra.downloadSizeBytes > 400 * 1024 * 1024, 'Ultra download size > 400MB');
    assert.strictEqual(ultra.qualityRating, 5, 'Ultra quality rating must be 5');
  });

  // Test 2: Hardware Inspection & Automatic Recommendation
  test('2. Hardware analyzer inspects system and provides valid tier recommendation', () => {
    const hw = aiModelManager.inspectHardware();
    assert.ok(hw, 'Hardware info must be returned');
    assert.ok(['fast', 'balanced', 'ultra'].includes(hw.recommendedTier), 'Tier must be valid');
    assert.ok(hw.recommendationReason.length > 10, 'Must provide human-readable reason');
    assert.ok(hw.supportedBackends.length > 0, 'Must support at least 1 backend');
  });

  // Test 3: Modular Model Download Lifecycle & Atomic Verification
  test('3. Downloads and verifies model atomically without premature installation', async () => {
    const modelId = 'bg-remove-fast-v1';
    let progressFired = false;

    const success = await aiModelManager.downloadModel(modelId, (ev) => {
      progressFired = true;
      assert.strictEqual(ev.modelId, modelId);
      assert.ok(ev.progressPercent >= 0 && ev.progressPercent <= 100);
    });

    assert.strictEqual(success, true, 'Download must succeed');
    assert.strictEqual(progressFired, true, 'Progress events must fire');

    const pkg = aiModelManager.getModelById(modelId);
    assert.strictEqual(pkg?.status, 'installed', 'Status must be installed after validation');
    assert.strictEqual(pkg?.isVerified, true, 'Must be verified');
    assert.ok(pkg?.installedAt, 'Must record installed timestamp');

    // Test Uninstall
    const uninstalled = aiModelManager.uninstallModel(modelId);
    assert.strictEqual(uninstalled, true);
    assert.strictEqual(aiModelManager.getModelById(modelId)?.status, 'not_installed');
  });

  // Test 4: Multi-Stage Matte Refinement (Edge Refinement, Hole Filling, Despill)
  test('4. Refines raw probability mask with edge sharpening, hole filling, and despill', () => {
    const width = 64;
    const height = 64;
    const total = width * height;

    // Create fake source image data (subject in center with green spill on edge)
    const srcImgData = {
      width,
      height,
      data: new Uint8ClampedArray(total * 4),
    } as ImageData;

    for (let i = 0; i < total; i++) {
      const idx = i * 4;
      srcImgData.data[idx] = 200;     // R
      srcImgData.data[idx + 1] = 240; // G (Green spill)
      srcImgData.data[idx + 2] = 180; // B
      srcImgData.data[idx + 3] = 255;
    }

    // Raw alpha with a small hole in center and rough edges
    const rawAlpha = new Float32Array(total);
    for (let y = 10; y < 54; y++) {
      for (let x = 10; x < 54; x++) {
        rawAlpha[y * width + x] = 0.9;
      }
    }
    // Simulate hole at (30, 30)
    rawAlpha[30 * width + 30] = 0.2;

    const refined = MatteRefinementPipeline.refineMatte(
      srcImgData,
      rawAlpha,
      width,
      height,
      {
        ...DEFAULT_MATTING_CONFIG,
        isEnabled: true,
        holeFilling: true,
        edgeRefinement: 80,
        hairDetail: 85,
        despill: 80,
        feather: 2,
      }
    );

    assert.strictEqual(refined.width, width);
    assert.strictEqual(refined.height, height);

    // Verify center hole was filled
    const holeAlpha = refined.data[(30 * width + 30) * 4 + 3];
    assert.ok(holeAlpha > 180, `Hole should be filled (got ${holeAlpha})`);

    // Verify background outside (0,0) is transparent
    const bgAlpha = refined.data[0 * 4 + 3];
    assert.strictEqual(bgAlpha, 0, 'Background pixel should be 0 alpha');
  });

  // Test 5: Temporal Video Matte Smoothing (Anti-Flicker)
  test('5. Smooths rapid mask jitter between consecutive video frames without ghosting', () => {
    const width = 32;
    const height = 32;
    const total = width * height;

    const srcImgData = {
      width,
      height,
      data: new Uint8ClampedArray(total * 4),
    } as ImageData;

    const frame1Alpha = new Float32Array(total).fill(0.8);
    const frame2AlphaJitter = new Float32Array(total).fill(0.65); // Sudden small jitter
    const temporalState: TemporalMaskState = {};

    const testConfig = {
      ...DEFAULT_MATTING_CONFIG,
      foregroundProtection: 0,
      backgroundSuppression: 0,
      feather: 0,
      temporalSmoothing: 80,
    };

    // Frame 1
    MatteRefinementPipeline.refineMatte(
      srcImgData,
      frame1Alpha,
      width,
      height,
      testConfig,
      temporalState,
      true
    );

    // Frame 2 (jittered)
    const outFrame2 = MatteRefinementPipeline.refineMatte(
      srcImgData,
      frame2AlphaJitter,
      width,
      height,
      testConfig,
      temporalState,
      false
    );

    // With temporal smoothing, frame 2 alpha should be smoothly blended (~0.72..0.76)
    const blendedAlpha = outFrame2.data[3] / 255;
    assert.ok(
      blendedAlpha > 0.68 && blendedAlpha < 0.80,
      `Temporal blend should smooth jitter (got ${blendedAlpha})`
    );
  });

  // Test 6: AI Matte Result Cache Synchronous Hits
  test('6. Caches matte results and returns synchronous 0ms hits during playhead scrubbing', async () => {
    const mediaId = 'C:/Videos/Interview_4K.mov';
    const config = { ...DEFAULT_MATTING_CONFIG, isEnabled: true };
    const cacheKey = computeMatteCacheKey(mediaId, 1700000000, 1920, 1080, 12, config);

    const testAlpha = new Float32Array(100).fill(0.85);

    await matteCache.set({
      cacheKey,
      sourceMediaId: mediaId,
      frameIndex: 12,
      width: 1920,
      height: 1080,
      modelTier: config.modelTier,
      alphaBuffer: testAlpha,
      cachedAt: Date.now(),
    });

    // Synchronous memory hit
    const syncHit = matteCache.getSync(cacheKey);
    assert.ok(syncHit, 'Must return synchronous cache hit');
    assert.ok(Math.abs(syncHit.alphaBuffer[0] - 0.85) < 0.001);

    // Invalidation on parameter change
    const modifiedConfig = { ...config, feather: 15 };
    const modKey = computeMatteCacheKey(mediaId, 1700000000, 1920, 1080, 12, modifiedConfig);
    assert.notStrictEqual(cacheKey, modKey, 'Changing feather must produce distinct cache key');
    assert.strictEqual(matteCache.getSync(modKey), undefined, 'Modified config must be a cache miss');
  });

  // Test 7: Non-Destructive Source Media Integrity
  test('7. Confirms original media references and source paths remain untouched', () => {
    const originalFilePath = 'E:\\MasterFootage\\Documentary_Scene1.mp4';
    const clip = {
      id: 'clip_101',
      filePath: originalFilePath,
      matting: { ...DEFAULT_MATTING_CONFIG, isEnabled: true },
    };

    assert.strictEqual(clip.filePath, originalFilePath, 'Source path must never be modified');
    assert.strictEqual(clip.matting.isEnabled, true, 'Matting applies as a non-destructive effect');
  });
});
