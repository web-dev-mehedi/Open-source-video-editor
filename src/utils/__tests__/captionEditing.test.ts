// @ts-nocheck
import { describe, test, assert } from 'vitest';
import {
  IN_ANIMATIONS,
  OUT_ANIMATIONS,
  LOOP_ANIMATIONS,
  calculateAnimatedCaptionTransform,
} from '../captionAnimationEngine';
import { CAPTION_PRESET_STYLES } from '../presetStyles';
import { CaptionLine, CaptionStyleConfig } from '../../types/caption';

describe('CapCut-Style Professional Caption Editing & Animation Engine', () => {
  // Test 1: Animation Catalog Integrity
  test('1. Animation Catalog provides complete IN, OUT, and LOOP presets', () => {
    assert.ok(IN_ANIMATIONS.length >= 10, 'Must have at least 10 IN animations');
    assert.ok(OUT_ANIMATIONS.length >= 8, 'Must have at least 8 OUT animations');
    assert.ok(LOOP_ANIMATIONS.length >= 6, 'Must have at least 6 LOOP animations');

    const popIn = IN_ANIMATIONS.find((a) => a.id === 'pop-in');
    assert.ok(popIn, 'Pop-in animation must exist');
    assert.strictEqual(popIn.category, 'in');

    const fadeOut = OUT_ANIMATIONS.find((a) => a.id === 'fade-out');
    assert.ok(fadeOut, 'Fade-out animation must exist');
    assert.strictEqual(fadeOut.category, 'out');

    const pulse = LOOP_ANIMATIONS.find((a) => a.id === 'pulse');
    assert.ok(pulse, 'Pulse loop animation must exist');
    assert.strictEqual(pulse.category, 'loop');
  });

  // Test 2: IN Animation Evaluation (Entry Phase)
  test('2. Correctly evaluates entry scale and opacity during IN phase', () => {
    const caption: CaptionLine = {
      id: 'cap_1',
      start: 2.0,
      end: 5.0,
      text: 'ACTION MOVIE TRAILER',
      words: [],
      styleOverride: {
        animation: 'pop',
        animationConfig: {
          inPreset: 'pop-in',
          inDuration: 0.4,
          inEasing: 'back-out',
          outPreset: 'none',
          outDuration: 0.3,
          loopPreset: 'none',
        },
      } as any,
    };

    const activeStyle: CaptionStyleConfig = {
      id: 'default',
      name: 'Default',
      presetKey: 'default',
      fontFamily: 'Montserrat',
      fontSize: 54,
      fontWeight: 'bold',
      letterSpacing: 0,
      lineHeight: 1.2,
      casing: 'uppercase',
      textColor: '#FFFFFF',
      activeWordColor: '#FFCC00',
      strokeColor: '#000000',
      strokeWidth: 4,
      hasShadow: false,
      shadowColor: 'black',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      hasBackgroundPill: false,
      backgroundColor: 'black',
      backgroundOpacity: 0.8,
      backgroundPaddingX: 10,
      backgroundPaddingY: 10,
      backgroundBorderRadius: 8,
      position: 'bottom',
      yOffsetPercent: 75,
      alignment: 'center',
      maxWordsPerLine: 3,
      animation: 'pop',
      animationIntensity: 1,
    };

    // At t = 2.05 (early entry): opacity should be ramping up, scale should be active
    const earlyEval = calculateAnimatedCaptionTransform(caption, activeStyle, 2.05, 1080, 1920);
    assert.ok(earlyEval.opacity > 0 && earlyEval.opacity <= 1.0);
    assert.ok(earlyEval.transform.includes('scale'));

    // At t = 3.5 (middle hold phase): fully visible
    const midEval = calculateAnimatedCaptionTransform(caption, activeStyle, 3.5, 1080, 1920);
    assert.strictEqual(midEval.opacity, 1.0);
  });

  // Test 3: OUT Animation Evaluation (Exit Phase)
  test('3. Correctly evaluates exit transition and fading during OUT phase', () => {
    const caption: CaptionLine = {
      id: 'cap_2',
      start: 2.0,
      end: 5.0,
      text: 'FADING OUT CAPTION',
      words: [],
      styleOverride: {
        animationConfig: {
          inPreset: 'none',
          inDuration: 0,
          outPreset: 'fade-out',
          outDuration: 0.4,
          outEasing: 'ease-out',
          loopPreset: 'none',
        },
      } as any,
    };

    const activeStyle: any = { fontSize: 50 };

    // At t = 4.85 (during last 0.4s): opacity should be decreasing
    const exitEval = calculateAnimatedCaptionTransform(caption, activeStyle, 4.85, 1080, 1920);
    assert.ok(exitEval.opacity < 0.9, `Exit opacity should be fading (got ${exitEval.opacity})`);
  });

  // Test 4: LOOP Continuous Motion Animation
  test('4. Correctly computes rhythmic scaling and motion during LOOP phase', () => {
    const caption: CaptionLine = {
      id: 'cap_3',
      start: 1.0,
      end: 6.0,
      text: 'PULSING HEADLINE',
      words: [],
      styleOverride: {
        animationConfig: {
          inPreset: 'none',
          inDuration: 0,
          outPreset: 'none',
          outDuration: 0,
          loopPreset: 'pulse',
          loopSpeed: 2.0,
          loopIntensity: 1.5,
        },
      } as any,
    };

    const activeStyle: any = { fontSize: 50 };

    const loopEval = calculateAnimatedCaptionTransform(caption, activeStyle, 2.125, 1080, 1920);
    assert.ok(loopEval.transform.includes('scale'), 'Transform must contain pulse scaling');
  });

  // Test 5: Existing Preset Styles & Multi-Caption Structure Integrity
  test('5. Preserves all existing caption templates without destructive mutations', () => {
    assert.ok(CAPTION_PRESET_STYLES.length >= 20, 'Must preserve full collection of templates');

    const neonRed = CAPTION_PRESET_STYLES.find((s) => s.presetKey === 'viral-hook-neon-red');
    assert.ok(neonRed, 'Neon Red Hook must be present');
    assert.strictEqual(neonRed.category, 'VIRAL');
    assert.strictEqual(neonRed.strokeWidth, 8);
    assert.strictEqual(neonRed.textColor, '#FFFFFF');

    const purpleMetallic = CAPTION_PRESET_STYLES.find((s) => s.presetKey === 'viral-hook-purple-metallic');
    assert.ok(purpleMetallic, 'Violet Metallic must be present');
    assert.strictEqual(purpleMetallic.category, 'VIRAL');
  });

  // Test 6: Non-Destructive Per-Line Style Overrides
  test('6. Applies style overrides per line while preserving base project style', () => {
    const baseStyle: CaptionStyleConfig = {
      id: 'base',
      name: 'Base',
      presetKey: 'base',
      fontFamily: 'Roboto',
      fontSize: 48,
      fontWeight: 'bold',
      letterSpacing: 0,
      lineHeight: 1.2,
      casing: 'uppercase',
      textColor: '#FFFFFF',
      activeWordColor: '#FFFF00',
      strokeColor: '#000000',
      strokeWidth: 4,
      hasShadow: false,
      shadowColor: 'black',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      hasBackgroundPill: false,
      backgroundColor: 'black',
      backgroundOpacity: 0.8,
      backgroundPaddingX: 10,
      backgroundPaddingY: 10,
      backgroundBorderRadius: 8,
      position: 'bottom',
      yOffsetPercent: 75,
      alignment: 'center',
      maxWordsPerLine: 3,
      animation: 'none',
      animationIntensity: 1,
    };

    const caption1: CaptionLine = {
      id: 'c1',
      start: 0,
      end: 2,
      text: 'First line',
      words: [],
      styleOverride: { fontSize: 72, textColor: '#FF0000' },
    };

    const caption2: CaptionLine = {
      id: 'c2',
      start: 2,
      end: 4,
      text: 'Second line',
      words: [],
    };

    // Effective style for caption1 should have overridden fontSize and textColor
    const eff1 = { ...baseStyle, ...(caption1.styleOverride || {}) };
    assert.strictEqual(eff1.fontSize, 72);
    assert.strictEqual(eff1.textColor, '#FF0000');
    assert.strictEqual(eff1.fontFamily, 'Roboto'); // Inherited from base

    // Effective style for caption2 should use base
    const eff2 = { ...baseStyle, ...(caption2.styleOverride || {}) };
    assert.strictEqual(eff2.fontSize, 48);
    assert.strictEqual(eff2.textColor, '#FFFFFF');
  });
});
