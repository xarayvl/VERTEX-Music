import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../../audio/audioEngine';

interface AudioVisualizerProps {
  isPlaying: boolean;
  accentColor?: string;
  secondaryColor?: string;
  height?: number;
  barCount?: number;
  variant?: 'bars' | 'wave' | 'minimal';
  maxHeightRatio?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  isPlaying,
  accentColor = '#30D158',
  secondaryColor = '#5E5CE6',
  height = 80,
  barCount = 28,
  variant = 'bars',
  maxHeightRatio = 0.9,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    // CSS-pixel dimensions the canvas is actually displayed at — drawing
    // math below stays in this space so bar gaps/radii look identical
    // regardless of devicePixelRatio.
    let width = 0;
    let h = height;

    // Keep the canvas's internal pixel buffer matched to its actual
    // displayed size (times devicePixelRatio) instead of a hardcoded
    // fixed-resolution buffer stretched via CSS — otherwise the bars
    // render blurry or squashed whenever the container is a different
    // width than that hardcoded value (e.g. the Now Playing screen at
    // different viewport widths).
    const syncCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, rect.width);
      h = height;
      const targetWidth = Math.max(1, Math.round(width * dpr));
      const targetHeight = Math.max(1, Math.round(h * dpr));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      // Reset then scale so all drawing coordinates below are in CSS pixels.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    syncCanvasSize();
    const resizeObserver = new ResizeObserver(syncCanvasSize);
    resizeObserver.observe(canvas);

    const render = () => {
      ctx.clearRect(0, 0, width, h);

      // Real analyser data drives playback; when paused the audio engine
      // deliberately returns its smooth synthetic spectrum. Keeping the same
      // rendering path gives every pause method the animated idle state that
      // previously appeared only after a hardware media-key pause.
      const freqData = audioEngine.getFrequencyData();

      if (variant === 'bars') {
        const gap = 4;
        const totalGap = gap * (barCount - 1);
        const barWidth = Math.max(2, (width - totalGap) / barCount);
        // Reserve headroom inside the visualizer so full-volume peaks and
        // their glow dots never visually collide with or cross the frame.
        const heightRatio = Math.min(0.96, Math.max(0.35, maxHeightRatio));
        const maxBarHeight = h * heightRatio;

        for (let i = 0; i < barCount; i++) {
          // sample frequency value
          const dataVal = freqData[i % freqData.length] || 12;
          const normalized = Math.min(1, Math.max(0.08, dataVal / 255));
          const barHeight = Math.min(maxBarHeight, Math.max(4, normalized * maxBarHeight));

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
          if (normalized > 0.3) {
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
          const v = (val / 255) * (h / 2);
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
          const bh = Math.max(3, (val / 255) * h);
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
      resizeObserver.disconnect();
    };
  }, [isPlaying, accentColor, secondaryColor, barCount, variant, height, maxHeightRatio]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full max-w-full pointer-events-none"
      style={{ height, width: variant === 'minimal' ? 24 : '100%' }}
    />
  );
};
