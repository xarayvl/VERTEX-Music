import type { CSSProperties, Key, ReactNode } from 'react';

export type LogoNodeItem = {
  node: ReactNode;
  title?: string;
  ariaLabel?: string;
  href?: string;
};

export type LogoImageItem = {
  src: string;
  srcSet?: string;
  sizes?: string;
  width?: number | string;
  height?: number | string;
  alt?: string;
  title?: string;
  href?: string;
};

export type LogoItem = LogoNodeItem | LogoImageItem;

export interface LogoLoopProps {
  logos: LogoItem[];
  speed?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
  width?: number | string;
  logoHeight?: number;
  gap?: number;
  pauseOnHover?: boolean;
  hoverSpeed?: number;
  fadeOut?: boolean;
  fadeOutColor?: string;
  scaleOnHover?: boolean;
  renderItem?: (item: LogoItem, key: Key) => ReactNode;
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
}

export const LogoLoop: React.MemoExoticComponent<(props: LogoLoopProps) => ReactNode>;

export default LogoLoop;
