import { CaptionLine, WordTimestamp } from '../types/ipc.types';

export function hexToAssColor(hex: string, alphaOverride?: number): string {
  if (!hex) return '&H00FFFFFF&';

  let cleanHex = hex.replace('#', '').trim();
  let r = 'FF', g = 'FF', b = 'FF', a = '00';

  if (cleanHex.startsWith('rgba') || cleanHex.startsWith('rgb')) {
    const match = cleanHex.match(/\(([^)]+)\)/);
    if (match) {
      const parts = match[1].split(',').map(p => p.trim());
      const rNum = parseInt(parts[0], 10) || 255;
      const gNum = parseInt(parts[1], 10) || 255;
      const bNum = parseInt(parts[2], 10) || 255;
      const aNum = parts[3] !== undefined ? parseFloat(parts[3]) : 1;

      r = rNum.toString(16).padStart(2, '0').toUpperCase();
      g = gNum.toString(16).padStart(2, '0').toUpperCase();
      b = bNum.toString(16).padStart(2, '0').toUpperCase();
      const assAlpha = Math.round((1 - aNum) * 255).toString(16).padStart(2, '0').toUpperCase();
      a = assAlpha;
      return `&H${a}${b}${g}${r}&`;
    }
  }

  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }

  if (cleanHex.length >= 6) {
    r = cleanHex.substring(0, 2).toUpperCase();
    g = cleanHex.substring(2, 4).toUpperCase();
    b = cleanHex.substring(4, 6).toUpperCase();
  }

  if (alphaOverride !== undefined) {
    const assAlpha = Math.round((1 - alphaOverride) * 255).toString(16).padStart(2, '0').toUpperCase();
    a = assAlpha;
  } else if (cleanHex.length === 8) {
    const alphaHex = cleanHex.substring(6, 8);
    const alphaVal = parseInt(alphaHex, 16) / 255;
    a = Math.round((1 - alphaVal) * 255).toString(16).padStart(2, '0').toUpperCase();
  }

  return `&H${a}${b}${g}${r}&`;
}

export function formatAssTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);

  const pad = (n: number, z: number = 2) => String(n).padStart(z, '0');
  return `${hrs}:${pad(mins)}:${pad(secs)}.${pad(centis, 2)}`;
}

export function formatSrtTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, z: number = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

export function generateAssSubtitle(
  captions: CaptionLine[],
  style: any,
  videoWidth: number = 1080,
  videoHeight: number = 1920
): string {
  const primaryColor = hexToAssColor(style.textColor || '#FFFFFF');
  const secondaryColor = hexToAssColor(style.secondaryColor || style.textColor || '#FFFFFF');
  const activeColor = hexToAssColor(style.activeWordColor || '#FACC15');
  const outlineColor = hexToAssColor(style.strokeColor || '#000000');
  const shadowColor = hexToAssColor(style.shadowColor || 'rgba(0,0,0,0.8)', 0.8);

  let alignment = 2;
  if (style.position === 'middle') alignment = 5;
  if (style.position === 'top') alignment = 8;
  if (style.position === 'lower-third') alignment = 2;
  if (style.alignment === 'left') alignment = style.position === 'top' ? 7 : (style.position === 'middle' ? 4 : 1);
  if (style.alignment === 'right') alignment = style.position === 'top' ? 9 : (style.position === 'middle' ? 6 : 3);

  const marginV = Math.round((100 - (style.yOffsetPercent || (style.position === 'top' ? 16 : style.position === 'lower-third' ? 82 : 75))) * videoHeight / 100);

  const header = `[Script Info]
Title: CaptionForge Subtitles
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
ScaledBorderAndShadow: yes
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${style.fontFamily || 'Montserrat'},${style.fontSize || 54},${primaryColor},${secondaryColor},${outlineColor},${shadowColor},-1,0,0,0,100,100,${style.letterSpacing || 1},0,1,${style.strokeWidth || 6},${style.hasShadow ? 4 : 0},${alignment},40,40,${marginV},1
Style: NeonGlow,${style.fontFamily || 'Montserrat'},${style.fontSize || 54},${primaryColor},${secondaryColor},${activeColor},${activeColor},-1,0,0,0,100,100,${style.letterSpacing || 1},0,1,${style.strokeWidth || 4},12,${alignment},40,40,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = captions.map((line) => {
    const startStr = formatAssTimestamp(line.start);
    const endStr = formatAssTimestamp(line.end);

    // Merge line style override
    const effStyle = { ...style, ...(line.styleOverride || {}) };
    const lineActiveColor = hexToAssColor(effStyle.activeWordColor || style.activeWordColor || '#FACC15');
    const linePrimaryColor = hexToAssColor(effStyle.textColor || style.textColor || '#FFFFFF');
    const lineSecondaryColor = hexToAssColor(effStyle.secondaryColor || '#94A3B8');

    const formatWord = (w: string) => {
      if (effStyle.casing === 'uppercase') return w.toUpperCase();
      if (effStyle.casing === 'lowercase') return w.toLowerCase();
      if (effStyle.casing === 'titlecase') return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      return w;
    };

    // 1. Dual-Tier Hook Formatting
    if (effStyle.layoutStyle === 'dual-tier-hook' && line.words && line.words.length >= 2) {
      const words = line.words;
      const splitIdx = typeof line.splitHookIndex === 'number' && line.splitHookIndex > 0 && line.splitHookIndex < words.length
        ? line.splitHookIndex
        : words.length <= 2 ? 1 : Math.max(1, Math.floor(words.length / 2));

      const topText = words.slice(0, splitIdx).map(w => formatWord(w.word)).join(' ');
      const bottomText = words.slice(splitIdx).map(w => formatWord(w.word)).join(' ');

      const topTag = `{\\i1\\fscx82\\fscy82\\c${linePrimaryColor}}${topText}{\\r}`;
      const bottomTag = `{\\b1\\i1\\fscx165\\fscy165\\c${lineActiveColor}\\3c&H000000&\\bord6}${bottomText}{\\r}`;
      const combined = `${topTag}\\N${bottomTag}`;
      return `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${combined}`;
    }

    // 2. Typewriter Incremental Formatting
    if (effStyle.animation === 'typewriter' && line.words && line.words.length > 0) {
      const words = line.words;
      const subEvents: string[] = [];
      let accumulated = '';

      for (let i = 0; i < words.length; i++) {
        accumulated += (i === 0 ? '' : ' ') + formatWord(words[i].word);
        const wStart = formatAssTimestamp(words[i].start);
        const wEnd = formatAssTimestamp(i < words.length - 1 ? words[i + 1].start : line.end);
        subEvents.push(`Dialogue: 0,${wStart},${wEnd},Default,,0,0,0,,${accumulated}`);
      }
      return subEvents.join('\n');
    }

    // 3. Glitch Chromatic Aberration Stacked Events
    if (effStyle.animation === 'glitch' && line.words && line.words.length > 0) {
      const fullText = line.words.map(w => formatWord(w.word)).join(' ');
      const redTag = `{\\pos(${Math.round(videoWidth / 2 - 4)},${Math.round(videoHeight * 0.74)})\\c&HFF0055&\\alpha&H40&}${fullText}`;
      const cyanTag = `{\\pos(${Math.round(videoWidth / 2 + 4)},${Math.round(videoHeight * 0.74)})\\c&H00F0FF&\\alpha&H40&}${fullText}`;
      const mainTag = `{\\pos(${Math.round(videoWidth / 2)},${Math.round(videoHeight * 0.74)})\\c${linePrimaryColor}}${fullText}`;

      return [
        `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${redTag}`,
        `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${cyanTag}`,
        `Dialogue: 1,${startStr},${endStr},Default,,0,0,0,,${mainTag}`
      ].join('\n');
    }

    // 4. Karaoke Style (Classic \k tags)
    if (effStyle.animation === 'karaoke' && line.words && line.words.length > 0) {
      let karaokeText = '';
      for (const w of line.words) {
        const durCentis = Math.max(1, Math.round((w.end - w.start) * 100));
        karaokeText += `{\\k${durCentis}}${formatWord(w.word)} `;
      }
      return `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${karaokeText.trim()}`;
    }

    // 5. Word-by-Word Active Highlighting Events (MrBeast, Hormozi, Bold Pop, Bounce, Punch, 3D, etc.)
    if (line.words && line.words.length > 0 && effStyle.animation !== 'none' && effStyle.animation !== 'cinematic') {
      const subEvents: string[] = [];
      const words = line.words;

      for (let i = 0; i < words.length; i++) {
        const activeWord = words[i];
        const prevWord = i > 0 ? words[i - 1] : null;
        const nextWord = i < words.length - 1 ? words[i + 1] : null;

        // Monotonic non-overlapping time boundaries
        let segStart = i === 0 ? line.start : (prevWord ? prevWord.end : activeWord.start);
        let segEnd = nextWord ? Math.min(activeWord.end, nextWord.start) : line.end;
        if (segEnd <= segStart) segEnd = segStart + 0.05;

        const wStart = formatAssTimestamp(segStart);
        const wEnd = formatAssTimestamp(segEnd);

        let formattedLine = '';
        const anim = effStyle.animation;

        for (let j = 0; j < words.length; j++) {
          const w = words[j];
          const text = formatWord(w.word);

          if (i === j) {
            let scaleTag = '';
            if (anim === 'mrbeast' || anim === 'hormozi' || anim === 'bold-pop' || anim === 'punch' || anim === 'word-pop' || anim === 'pop') {
              const scalePct = Math.round((effStyle.highlightScale || 1.3) * 100);
              scaleTag = `\\fscx${scalePct}\\fscy${scalePct}`;
            } else if (anim === 'bounce') {
              scaleTag = `\\fscx118\\fscy118`;
            } else if (anim === '3d') {
              scaleTag = `\\fscx125\\fscy125\\shad8\\4c&H0369A1&`;
            }

            formattedLine += `{\\b1\\c${lineActiveColor}${scaleTag ? `${scaleTag}` : ''}}${text}{\\r} `;
          } else {
            const dimmed = anim === 'karaoke' ? `\\alpha&H80&\\c${lineSecondaryColor}` : `\\c${linePrimaryColor}`;
            formattedLine += `{${dimmed}}${text}{\\r} `;
          }
        }
        subEvents.push(`Dialogue: 0,${wStart},${wEnd},Default,,0,0,0,,${formattedLine.trim()}`);
      }
      return subEvents.join('\n');
    }

    const fullText = formatWord(line.text);
    return `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${fullText}`;
  }).join('\n');

  return header + events;
}

export function generateSrtSubtitle(captions: CaptionLine[], casing: string = 'preserve'): string {
  if (!captions || !Array.isArray(captions)) return '';
  return captions.map((line, index) => {
    let text = line.text || '';
    if (casing === 'uppercase') text = text.toUpperCase();
    if (casing === 'lowercase') text = text.toLowerCase();
    if (casing === 'titlecase') text = text.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

    return `${index + 1}\n${formatSrtTimestamp(line.start)} --> ${formatSrtTimestamp(line.end)}\n${text}\n`;
  }).join('\n');
}

export function generateVttSubtitle(captions: CaptionLine[]): string {
  if (!captions || !Array.isArray(captions)) return 'WEBVTT\n\n';
  const body = captions.map((line) => {
    const s = formatSrtTimestamp(line.start).replace(',', '.');
    const e = formatSrtTimestamp(line.end).replace(',', '.');
    return `${s} --> ${e}\n${line.text || ''}\n`;
  }).join('\n');

  return `WEBVTT\n\n${body}`;
}
