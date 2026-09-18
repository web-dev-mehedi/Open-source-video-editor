export interface ChromaKeyConfig {
  enabled: boolean;
  keyColor: string; // Hex color string, e.g. '#00FF00'
  similarity: number; // Tolerance / color distance threshold: 0 to 100
  smoothness: number; // Edge softness falloff: 0 to 100
  spillReduction: number; // Desaturate green/blue halo spill: 0 to 100
  maskOnly?: boolean; // Display black & white matte
}

export const DEFAULT_CHROMA_KEY: ChromaKeyConfig = {
  enabled: false,
  keyColor: '#00FF00',
  similarity: 35,
  smoothness: 15,
  spillReduction: 40,
  maskOnly: false,
};
