import type { CSSProperties, ReactNode } from 'react';

type DisplacementChannel = 'R' | 'G' | 'B';
type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export interface GlassSurfaceProps {
  children?: ReactNode;
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  borderWidth?: number;
  brightness?: number;
  opacity?: number;
  blur?: number;
  displace?: number;
  backgroundOpacity?: number;
  saturation?: number;
  distortionScale?: number;
  redOffset?: number;
  greenOffset?: number;
  blueOffset?: number;
  xChannel?: DisplacementChannel;
  yChannel?: DisplacementChannel;
  mixBlendMode?: BlendMode;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

declare const GlassSurface: (props: GlassSurfaceProps) => ReactNode;

export default GlassSurface;
