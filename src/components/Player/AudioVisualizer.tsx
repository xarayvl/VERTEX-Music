import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../../audio/audioEngine';

interface AudioVisualizerProps {
  isPlaying: boolean;
  accentColor?: string;
  secondaryColor?: string;
  height?: number;
  barCount?: number;
  variant?: 'bars' | 'wave' | 'minimal';
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  accentColor = '#30D158',
  secondaryColor = '#5E5CE6',
  height = 80,
  barCount = 28,
  variant = 'bars',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, width, h);

      const freqData = isPlaying
        ? audioEngine.getFrequencyData()
        : new Uint8Array(barCount).fill(8);

      if (variant === 'bars') {
        const gap = 4;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2, (width - totalGap) / barCount);

        for (let i = 0; i < barCount; i++) {
          // sample frequency value
          const dataVal = freqData[i % freqData.length] || 12;
          const normalized = isPlaying ? Math.min(1, Math.max(0.08, dataVal / 255)) : 0.08;
          const barHeight = Math.max(4, normalized * h);

          const x = i * (barWidth + gap);
          const y = h - barHeight;

          // Gradient fill
          const grad = ctx.createLinearGradient(0, h, 0, 0);
          grad.addColorStop(0, secondaryColor);
          grad.addColorStop(1, accentColor);

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          // Top glow dot
          if (isPlaying && normalized > 0.3) {
            ctx.shadowColor = accentColor;
            ctx.shadowBlur = 8;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, y - 2, 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }
      } else if (variant === 'wave') {
        ctx.beginPath();
        ctx.lineWidth = 3;
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, accentColor);
        grad.addColorStop(0.5, secondaryColor);
        grad.addColorStop(1, accentColor);
        ctx.strokeStyle = grad;

        const sliceWidth = width / barCount;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
          const val = freqData[i % freqData.length] || 10;
          const v = isPlaying ? (val / 255) * (h / 2) : 3;
          const y = h / 2 + (i % 2 === 0 ? v : -v);

          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);

          x += sliceWidth;
        }

        ctx.shadowColor = accentColor;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Minimal equalizer bars for mini player
        const barW = 3;
        const barG = 2;
        for (let i = 0; i < 4; i++) {
          const val = freqData[i * 2] || 10;
          const bh = isPlaying ? Math.max(3, (val / 255) * h) : 4;
          const x = i * (barW + barG);
          const y = (h - bh) / 2;

          ctx.fillStyle = accentColor;
          ctx.fillRect(x, y, barW, bh);
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, accentColor, secondaryColor, barCount, variant]);

  return (
    <canvas
      ref={canvasRef}
      width={variant === 'minimal' ? 24 : 320}
      height={height}
      className="w-full max-w-full pointer-events-none"
    />
  );
};
