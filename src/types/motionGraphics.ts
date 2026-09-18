export type MotionGraphicCategory =
  | 'lower-third'
  | 'title'
  | 'callout'
  | 'social-cta'
  | 'badge';

export interface MotionGraphicParams {
  title: string;
  subtitle?: string;
  handle?: string;
  numberValue?: string;
  accentColor: string;
  secondaryColor?: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  fontSize: number;
  scale: number; // 0.2 to 3.0
  x: number; // 0 to 100 percentage
  y: number; // 0 to 100 percentage
  opacity: number; // 0 to 1.0
  animationStyle: 'slide' | 'fade' | 'zoom' | 'bounce' | 'glitch' | 'pop';
  durationInSeconds: number;
}

export interface MotionGraphicTemplate {
  id: string;
  name: string;
  category: MotionGraphicCategory;
  description: string;
  badge?: 'PRO' | 'HOT' | 'NEW' | 'TRENDING';
  bgGradient: string;
  accentColor: string;
  defaultParams: MotionGraphicParams;
}
