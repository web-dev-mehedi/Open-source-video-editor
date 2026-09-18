import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { CaptionLine, WordTimestamp } from '../types/ipc.types';

export class GeminiService {
  /**
   * Transcribe audio file to word-by-word synchronized caption lines using Gemini Multimodal API
   */
  public async transcribeAudio(
    audioFilePath: string,
    apiKey: string,
    language?: string,
    preferredModel?: string
  ): Promise<CaptionLine[]> {
    if (!apiKey || !apiKey.trim()) {
      throw new Error('Gemini API Key is required. Please add your key in Settings or in the modal.');
    }

    if (!fs.existsSync(audioFilePath)) {
      throw new Error(`Audio file not found at ${audioFilePath}`);
    }

    const genAI = new GoogleGenerativeAI(apiKey.trim());

    const audioBuffer = fs.readFileSync(audioFilePath);
    const base64Audio = audioBuffer.toString('base64');

    const ext = path.extname(audioFilePath).toLowerCase();
    let mimeType = 'audio/mp3';
    if (ext === '.wav') mimeType = 'audio/wav';
    else if (ext === '.mp4') mimeType = 'video/mp4';
    else if (ext === '.webm') mimeType = 'video/webm';
    else if (ext === '.m4a' || ext === '.aac') mimeType = 'audio/aac';
    else if (ext === '.ogg') mimeType = 'audio/ogg';

    // Prioritized high-speed multimodal speech transcription models (Official Gemini API)
    const transcriptionPriority = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];
    const candidateModelNames: string[] = [
      ...(preferredModel ? [preferredModel] : []),
      ...transcriptionPriority,
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    const prompt = `You are Gemini's dedicated VERBATIM speech transcription engine with WORD-LEVEL TIMESTAMP capability (model: gemini-3.5-transcribe / gemini-2.0-flash transcription mode).

ABSOLUTE PRIORITY: VERBATIM FIRST, CLEANUP SECOND
- Transcribe EXACTLY what is spoken, preserving filler words (uh, um), repetitions, false starts, corrections.
- Do NOT rewrite, summarize, or clean before timing is established. Timing source must be the verbatim sequence.

TIMING-CRITICAL REQUIREMENTS (P2, P5-P6, P8-P10):
- Every spoken word MUST have precise start_ms and end_ms (millisecond offsets from audio start).
- Use Gemini's word-level timestamp capability (transcription model). Do NOT estimate timestamps as text_length / duration.
- If word confidence is available, include "confidence" (0.0-1.0). If speaker label available, include "speaker".
- All timestamps must be integers in milliseconds, 0 <= start < end, strictly increasing with speech.
- Segment boundaries must derive from word timing: segment start = first word start, segment end = last word end.
- Language: ${language && language !== 'auto' ? language : 'Auto-detect (detect language automatically; support English, Bengali বাংলা, Hindi, etc.)'}.

OUTPUT: Raw JSON only, no markdown fences, exactly:
{
  "detected_language": "en",
  "language_confidence": 0.99,
  "verbatim_transcript": "uh I think this is really good",
  "total_words": 7,
  "words": [
    {"word": "uh", "start_ms": 120, "end_ms": 280, "confidence": 0.92, "speaker": "A"},
    {"word": "I", "start_ms": 310, "end_ms": 380, "confidence": 0.98}
  ],
  "subtitles": [
    {
      "id": 1,
      "start_ms": 120,
      "end_ms": 1800,
      "text": "uh I think",
      "words": [
        {"word": "uh", "start_ms": 120, "end_ms": 280, "confidence": 0.92},
        {"word": "I", "start_ms": 310, "end_ms": 380},
        {"word": "think", "start_ms": 400, "end_ms": 700}
      ]
    }
  ]
}
CRITICAL: Use verbatim transcript for word list. Subtitle text must match its words verbatim (no cleaning yet). Never drop initial words (Hi, Hello, etc.).`;

    let responseText = '';
    let primaryError: any = null;
    let lastError: any = null;

    for (let mIdx = 0; mIdx < candidateModelNames.length; mIdx++) {
      const targetModelName = candidateModelNames[mIdx];
      try {
        const model = genAI.getGenerativeModel({
          model: targetModelName,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.0,
          },
        });

        const result = await model.generateContent([
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          { text: prompt },
        ]);

        responseText = result.response.text();
        if (responseText) {
          break;
        }
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || '';
        console.warn(`Model ${targetModelName} error, trying next candidate:`, msg);

        // Auto-recovery: If Google API suggested a replacement model in the error message
        const matches = msg.match(/models\/([a-zA-Z0-9\.\-_]+)/g);
        if (matches && matches.length > 1) {
          const suggestedModel = matches[matches.length - 1].replace(/^models\//, '');
          if (suggestedModel && !candidateModelNames.includes(suggestedModel)) {
            candidateModelNames.splice(mIdx + 1, 0, suggestedModel);
          }
        }
      }
    }

    // Clean up temporary extracted speech file if it was created in tmp
    if (audioFilePath.includes('speech_') || audioFilePath.includes('16k_')) {
      try {
        fs.unlink(audioFilePath, () => {});
      } catch (e) {}
    }

    if (!responseText) {
      throw lastError || primaryError || new Error('Google Gemini API returned an empty response.');
    }
    let parsed: any = null;
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    // Two-layer parsing: verbatim flat words + subtitles
    const flatWordsRaw: any[] = Array.isArray(parsed?.words) ? parsed.words : [];
    const rawListBase: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.subtitles)
      ? parsed.subtitles
      : Array.isArray(parsed?.segments)
      ? parsed.segments
      : flatWordsRaw.length > 0
      ? []
      : [];
    let effectiveRawList = rawListBase;
    if (effectiveRawList.length === 0 && flatWordsRaw.length > 0) {
      const maxWords = 3, maxChars = 28, maxPauseGap = 0.55;
      let currentGroup: any[] = [], currentChars = 0;
      const groups: any[][] = [];
      for (let i = 0; i < flatWordsRaw.length; i++) {
        const w = flatWordsRaw[i];
        const prev = flatWordsRaw[i - 1];
        const gap = prev ? (w.start_ms !== undefined ? w.start_ms / 1000 : Number(w.start) || 0) - (prev.end_ms !== undefined ? prev.end_ms / 1000 : Number(prev.end) || 0) : 0;
        const wordLen = String(w.word || '').length;
        const shouldBreak = currentGroup.length >= maxWords || currentChars + wordLen > maxChars || gap > maxPauseGap;
        if (shouldBreak && currentGroup.length > 0) { groups.push(currentGroup); currentGroup = []; currentChars = 0; }
        currentGroup.push(w);
        currentChars += wordLen + 1;
      }
      if (currentGroup.length > 0) groups.push(currentGroup);
      effectiveRawList = groups.map((grp: any, gi: number) => ({
        id: gi + 1,
        start_ms: grp[0]?.start_ms ?? grp[0]?.start,
        end_ms: grp[grp.length - 1]?.end_ms ?? grp[grp.length - 1]?.end,
        text: grp.map((g: any) => g.word).join(' '),
        words: grp,
      }));
    }
    if (effectiveRawList.length === 0) {
      throw new Error('No speech dialogue detected in the audio file.');
    }
    let hasWordTimestamps = false;
    for (const seg of effectiveRawList) {
      const wl = Array.isArray(seg.words) ? seg.words : [];
      if (wl.length > 0 && (wl[0].start_ms !== undefined || wl[0].start !== undefined)) { hasWordTimestamps = true; break; }
    }
    if (!hasWordTimestamps && flatWordsRaw.length > 0) {
      hasWordTimestamps = flatWordsRaw.some((w: any) => w.start_ms !== undefined || w.start !== undefined);
    }

    const captions: CaptionLine[] = [];
    let globalCapIdx = 0, globalSourceIdx = 0;
    effectiveRawList.forEach((item: any, idx: number) => {
      const rawStart = item.start_ms !== undefined ? item.start_ms / 1000 : Number(item.start) || 0;
      const rawEnd = item.end_ms !== undefined ? item.end_ms / 1000 : Number(item.end) || rawStart + 1.5;
      const startSec = Math.max(0, Math.round(rawStart * 100) / 100);
      const endSec = Math.max(startSec + 0.2, Math.round(rawEnd * 100) / 100);
      const wordsList: any[] = Array.isArray(item.words) ? item.words : [];
      const words: WordTimestamp[] = wordsList.map((w: any, wIdx: number) => {
        const wRawStart = w.start_ms !== undefined ? w.start_ms / 1000 : Number(w.start) || startSec;
        const wRawEnd = w.end_ms !== undefined ? w.end_ms / 1000 : Number(w.end) || wRawStart + (endSec - startSec) / Math.max(1, wordsList.length);
        const hasRealTiming = w.start_ms !== undefined || w.start !== undefined;
        return {
          id: `w_${Date.now()}_${idx}_${wIdx}`,
          word: String(w.word || '').trim(),
          originalWord: String(w.word || '').trim(),
          normalizedText: String(w.word || '').trim(),
          start: Math.max(startSec, Math.round(wRawStart * 100) / 100),
          end: Math.min(endSec + 0.1, Math.round(wRawEnd * 100) / 100),
          confidence: typeof w.confidence === 'number' ? w.confidence : hasRealTiming ? 0.92 : 0.5,
          speaker: w.speaker || w.speaker_label || undefined,
          sourceIndex: globalSourceIdx + wIdx,
          displayIndex: wIdx,
          accuracyStatus: (hasRealTiming ? 'exact' : 'estimated') as any,
        };
      });
      globalSourceIdx += words.length;
      let segStart = words.length > 0 ? words[0].start : startSec;
      let segEnd = words.length > 0 ? words[words.length - 1].end : endSec;
      segStart = Math.round(segStart * 100) / 100;
      segEnd = Math.round(segEnd * 100) / 100;
      words.sort((a, b) => a.start - b.start);
      for (let wi = 1; wi < words.length; wi++) {
        if (words[wi].start < words[wi - 1].end - 0.005) {
          const dur = words[wi].end - words[wi].start;
          words[wi].start = Math.round(words[wi - 1].end * 100) / 100;
          words[wi].end = Math.round((words[wi].start + Math.max(0.08, dur)) * 100) / 100;
        }
        if (words[wi].end <= words[wi].start) words[wi].end = Math.round((words[wi].start + 0.12) * 100) / 100;
      }
      if (words.length > 0) { segStart = words[0].start; segEnd = words[words.length - 1].end; }
      const hasExact = words.every((w: any) => w.accuracyStatus === 'exact');
      const segAccuracy: any = hasExact ? 'exact' : words.some((w: any) => w.accuracyStatus === 'exact') ? 'partial' : 'estimated';
      if (words.length > 3) {
        const CHUNK_SIZE = words.length <= 4 ? 2 : 3;
        for (let i = 0; i < words.length; i += CHUNK_SIZE) {
          const chunkWords = words.slice(i, i + CHUNK_SIZE);
          chunkWords.forEach((cw: any, ci: number) => (cw.displayIndex = ci));
          captions.push({
            id: `cap_${Date.now()}_${globalCapIdx++}`,
            start: chunkWords[0].start,
            end: Math.max(chunkWords[0].start + 0.2, chunkWords[chunkWords.length - 1].end),
            text: chunkWords.map((w) => w.word).join(' ').trim(),
            sourceText: chunkWords.map((w) => (w as any).originalWord || w.word).join(' '),
            words: chunkWords,
            sourceWords: chunkWords.map((w) => ({ ...w })),
            accuracyStatus: chunkWords.every((w: any) => w.accuracyStatus === 'exact') ? 'exact' : 'partial',
            splitHookIndex: chunkWords.length > 1 ? 1 : undefined,
          } as any);
        }
      } else {
        captions.push({
          id: `cap_${Date.now()}_${globalCapIdx++}`,
          start: segStart,
          end: Math.max(segStart + 0.2, segEnd),
          text: String(item.text || words.map((w) => w.word).join(' ')).trim(),
          sourceText: String(item.text || words.map((w: any) => w.originalWord || w.word).join(' ')).trim(),
          words,
          sourceWords: words.map((w) => ({ ...w })),
          accuracyStatus: segAccuracy,
          splitHookIndex: words.length > 1 ? 1 : undefined,
        } as any);
      }
    });
    captions.sort((a, b) => a.start - b.start);
    for (let i = 1; i < captions.length; i++) {
      if (captions[i].start < captions[i - 1].end - 0.005) {
        const delta = captions[i - 1].end - captions[i].start;
        captions[i].start = Math.round(captions[i - 1].end * 100) / 100;
        captions[i].end = Math.round((captions[i].end + delta) * 100) / 100;
        captions[i].words = captions[i].words.map((w) => ({ ...w, start: Math.round((w.start + delta) * 100) / 100, end: Math.round((w.end + delta) * 100) / 100 }));
      }
    }
    if (!hasWordTimestamps) {
      captions.forEach((c: any) => { c.accuracyStatus = 'estimated'; c.words.forEach((w: any) => { w.accuracyStatus = 'estimated'; w.confidence = 0.5; }); });
    }
    return captions;
  }

  /**
   * Translate existing captions to a target language preserving timestamps
   */
  public async translateCaptions(
    captions: CaptionLine[],
    targetLangCode: string,
    apiKey: string
  ): Promise<CaptionLine[]> {
    if (!apiKey) {
      throw new Error('Gemini API Key is required for translation.');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const prompt = `You are an expert video subtitle translator.
Translate the following video caption lines into target language code "${targetLangCode}".
Preserve all timing stamps ("start", "end") accurately.
For each translated line, provide the translated words with proportional start/end timestamps within that line's duration.

Input JSON:
${JSON.stringify(captions, null, 2)}

Return ONLY valid JSON matching the exact schema of the input array.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    let parsed: any[] = [];
    try {
      parsed = JSON.parse(responseText);
    } catch (e) {
      const cleanJson = responseText.replace(/```json/gi, '').replace(/```/gi, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    return parsed.map((item, idx) => ({
      id: item.id || `cap_trans_${Date.now()}_${idx}`,
      start: Number(item.start) || captions[idx]?.start || 0,
      end: Number(item.end) || captions[idx]?.end || 1,
      text: item.text || '',
      words: Array.isArray(item.words)
        ? item.words.map((w: any, wIdx: number) => ({
            id: w.id || `w_trans_${Date.now()}_${idx}_${wIdx}`,
            word: String(w.word || '').trim(),
            start: Number(w.start) || 0,
            end: Number(w.end) || 0.5,
          }))
        : [],
    }));
  }

  /**
   * Generate offline mock speech transcription for testing without an API key
   */
  public generateOfflineDemoCaptions(durationSeconds: number): CaptionLine[] {
    const demoPhrases = [
      'Welcome to CaptionForge',
      'Forge viral videos with AI captions',
      'Offline editing at lightning speed',
      'Ten plus animated styles included',
      'Hormozi bold and MrBeast pop',
      'Full four K rendering engine',
      'Export and dominate your feed today',
    ];

    const captions: CaptionLine[] = [];
    let currentTime = 0.5;

    for (let i = 0; i < demoPhrases.length; i++) {
      if (currentTime >= durationSeconds - 0.5 && durationSeconds > 3) break;

      const phrase = demoPhrases[i];
      const words = phrase.split(' ');
      const lineDuration = words.length * 0.38 + 0.2;
      const lineEnd = Math.min(
        currentTime + lineDuration,
        durationSeconds > 0 ? durationSeconds : 100
      );

      const wordTimestamps: WordTimestamp[] = [];
      const wordDur = (lineEnd - currentTime) / words.length;

      words.forEach((w, wIdx) => {
        const wStart = currentTime + wIdx * wordDur;
        const wEnd = wStart + wordDur * 0.95;
        wordTimestamps.push({
          id: `w_demo_${i}_${wIdx}`,
          word: w,
          start: Math.round(wStart * 100) / 100,
          end: Math.round(wEnd * 100) / 100,
        });
      });

      captions.push({
        id: `cap_demo_${i}`,
        start: Math.round(currentTime * 100) / 100,
        end: Math.round(lineEnd * 100) / 100,
        text: phrase,
        words: wordTimestamps,
      });

      currentTime = lineEnd + 0.25;
    }

    return captions;
  }
}
