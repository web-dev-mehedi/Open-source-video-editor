/**
 * Converts seconds to formatted timecode HH:MM:SS.mmm or MM:SS
 */
export function formatTimecode(seconds: number, includeMillis: boolean = true, fps: number = 30): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  const frames = Math.floor((seconds % 1) * fps);

  const pad = (n: number, z: number = 2) => String(n).padStart(z, '0');

  if (hrs > 0) {
    if (includeMillis) {
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
    }
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  } else {
    if (includeMillis) {
      return `${pad(mins)}:${pad(secs)}.${pad(millis, 3)}`;
    }
    return `${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  }
}

/**
 * Converts seconds to SRT timestamp format (00:00:00,000)
 */
export function formatSrtTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);

  const pad = (n: number, z: number = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}

/**
 * Converts seconds to ASS timestamp format (0:00:00.00)
 */
export function formatAssTimestamp(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;
  
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);

  const pad = (n: number, z: number = 2) => String(n).padStart(z, '0');
  return `${hrs}:${pad(mins)}:${pad(secs)}.${pad(centis, 2)}`;
}

export function sanitizeTime(v: number, fallback: number = 0): number {
  if (!isFinite(v) || isNaN(v)) return fallback;
  return v;
}

/**
 * Parse timecode string to seconds
 */
export function parseTimecodeToSeconds(timecodeStr: string): number {
  if (!timecodeStr) return 0;
  
  // Format: HH:MM:SS.mmm or MM:SS.mmm or MM:SS
  const parts = timecodeStr.split(':');
  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2].replace(',', '.'));
    return hrs * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1].replace(',', '.'));
    return mins * 60 + secs;
  }
  return parseFloat(timecodeStr) || 0;
}
