import { cn } from '@/lib/utils';

interface HeroProps {
  className?: string;
}

export const Hero = ({ className }: HeroProps) => {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 h-full w-full bg-[#121212] [background-image:radial-gradient(120%_100%_at_50%_0%,rgba(217,70,239,0.16)_0%,rgba(168,85,247,0.07)_38%,rgba(18,18,18,0)_72%)]" />
    </div>
  );
};
