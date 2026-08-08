import type { ComponentPropsWithoutRef } from 'react';

type VertexLogoProps = Omit<ComponentPropsWithoutRef<'img'>, 'src'>;

export const VertexLogo = ({
  alt = 'VERTEX Music',
  className = '',
  ...props
}: VertexLogoProps) => (
  <img
    {...props}
    src="/vertex-logo.png"
    alt={alt}
    width={861}
    height={653}
    draggable={false}
    className={`block select-none object-contain ${className}`}
  />
);

export default VertexLogo;
