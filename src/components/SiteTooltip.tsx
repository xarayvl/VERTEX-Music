import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipContent = {
  text: string;
  anchorRect: DOMRect;
};

type TooltipPosition = {
  left: number;
  top: number;
};

const TOOLTIP_DELAY_MS = 180;
const TOOLTIP_GAP = 10;
const VIEWPORT_PADDING = 8;

const findTooltipTarget = (target: EventTarget | null): HTMLElement | null => {
  if (!(target instanceof Element)) return null;
  return target.closest<HTMLElement>('button[title], a[title], [role="button"][title]');
};

export const SiteTooltip: React.FC = () => {
  const [tooltip, setTooltip] = useState<TooltipContent | null>(null);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const originalTitlesRef = useRef(new WeakMap<HTMLElement, string>());

  const cancelTimer = () => {
    if (showTimerRef.current === null) return;
    window.clearTimeout(showTimerRef.current);
    showTimerRef.current = null;
  };

  const restoreNativeTitle = (target: HTMLElement | null) => {
    if (!target) return;
    const originalTitle = originalTitlesRef.current.get(target);
    if (originalTitle && !target.hasAttribute('title')) target.setAttribute('title', originalTitle);
    originalTitlesRef.current.delete(target);
  };

  const hideTooltip = () => {
    cancelTimer();
    restoreNativeTitle(activeTargetRef.current);
    activeTargetRef.current = null;
    setTooltip(null);
    setPosition(null);
  };

  const prepareTarget = (target: HTMLElement): string => {
    const currentTitle = target.getAttribute('title')?.trim();
    if (currentTitle) {
      originalTitlesRef.current.set(target, currentTitle);
      target.removeAttribute('title');
      return currentTitle;
    }
    return originalTitlesRef.current.get(target) || '';
  };

  const queueTooltip = (target: HTMLElement) => {
    if (activeTargetRef.current === target) return;
    hideTooltip();

    const text = prepareTarget(target);
    if (!text) return;

    activeTargetRef.current = target;
    showTimerRef.current = window.setTimeout(() => {
      if (activeTargetRef.current !== target || !target.isConnected) return;
      setPosition(null);
      setTooltip({ text, anchorRect: target.getBoundingClientRect() });
      showTimerRef.current = null;
    }, TOOLTIP_DELAY_MS);
  };

  useEffect(() => {
    const handlePointerOver = (event: PointerEvent) => {
      const target = findTooltipTarget(event.target);
      if (target) queueTooltip(target);
    };

    const handlePointerOut = (event: PointerEvent) => {
      const activeTarget = activeTargetRef.current;
      if (!activeTarget) return;
      if (event.relatedTarget instanceof Node && activeTarget.contains(event.relatedTarget)) return;
      if (activeTarget.contains(event.target as Node)) hideTooltip();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = findTooltipTarget(event.target);
      if (target) queueTooltip(target);
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (activeTargetRef.current?.contains(event.target as Node)) hideTooltip();
    };

    const handleViewportChange = () => hideTooltip();

    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);
    document.addEventListener('focusin', handleFocusIn, true);
    document.addEventListener('focusout', handleFocusOut, true);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      cancelTimer();
      restoreNativeTitle(activeTargetRef.current);
      document.removeEventListener('pointerover', handlePointerOver, true);
      document.removeEventListener('pointerout', handlePointerOut, true);
      document.removeEventListener('focusin', handleFocusIn, true);
      document.removeEventListener('focusout', handleFocusOut, true);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, []);

  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!tooltip || !element) return;

    const tooltipRect = element.getBoundingClientRect();
    const centeredLeft = tooltip.anchorRect.left + (tooltip.anchorRect.width - tooltipRect.width) / 2;
    const left = Math.min(
      window.innerWidth - tooltipRect.width - VIEWPORT_PADDING,
      Math.max(VIEWPORT_PADDING, centeredLeft),
    );
    const belowTop = tooltip.anchorRect.bottom + TOOLTIP_GAP;
    const top = belowTop + tooltipRect.height <= window.innerHeight - VIEWPORT_PADDING
      ? belowTop
      : Math.max(VIEWPORT_PADDING, tooltip.anchorRect.top - tooltipRect.height - TOOLTIP_GAP);

    setPosition({ left, top });
  }, [tooltip]);

  if (!tooltip || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={tooltipRef}
      role="tooltip"
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
      className="pointer-events-none fixed z-[10000] max-w-[min(18rem,calc(100vw-1rem))] rounded-lg border border-white/[0.12] bg-[#1B1B1E]/95 px-3 py-2 text-center text-[11px] font-bold leading-4 text-zinc-200 shadow-[0_14px_38px_rgba(0,0,0,0.65)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
    >
      {tooltip.text}
    </div>,
    document.body,
  );
};

export default SiteTooltip;
