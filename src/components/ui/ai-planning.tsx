import React, { useEffect, useState } from 'react';
import { AlertTriangle, BrainCircuit, Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';

export type PlanStepStatus = 'pending' | 'active' | 'success' | 'error';

export interface PlanStep {
  id: string;
  title: string;
  content?: React.ReactNode;
  status: PlanStepStatus;
  icon?: React.ReactNode;
  duration?: string;
  defaultExpanded?: boolean;
}

interface AgentPlanningProps {
  title?: string;
  steps: PlanStep[];
  defaultExpanded?: boolean;
  className?: string;
}

const statusClasses: Record<PlanStepStatus, string> = {
  success: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
  active: 'bg-[#D946EF]/20 text-[#F0ABFC] ring-[#D946EF]/25',
  error: 'bg-rose-500/15 text-rose-300 ring-rose-400/20',
  pending: 'bg-white/[0.05] text-zinc-600 ring-white/[0.06]',
};

export const AgentPlanning: React.FC<AgentPlanningProps> = ({
  title = 'Reasoning steps',
  steps,
  defaultExpanded = true,
  className = '',
}) => {
  const [isMainExpanded, setIsMainExpanded] = useState(defaultExpanded);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>(() =>
    steps.reduce<Record<string, boolean>>((expanded, step) => {
      expanded[step.id] = step.defaultExpanded === true;
      return expanded;
    }, {}),
  );
  const activeStepId = steps.find((step) => step.status === 'active')?.id;

  useEffect(() => {
    if (!activeStepId) return;
    setExpandedSteps((current) => ({ ...current, [activeStepId]: true }));
  }, [activeStepId]);

  const hasActive = steps.some((step) => step.status === 'active');
  const allSuccess = steps.length > 0 && steps.every((step) => step.status === 'success');

  const toggleStep = (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setExpandedSteps((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <div className={`w-full max-w-lg font-sans text-zinc-100 ${className}`}>
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#202020] shadow-lg">
        <button
          type="button"
          onClick={() => setIsMainExpanded((expanded) => !expanded)}
          aria-expanded={isMainExpanded}
          className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
            isMainExpanded ? 'border-b border-white/[0.06] bg-white/[0.025]' : 'hover:bg-white/[0.035]'
          }`}
        >
          <span className="flex items-center gap-2.5">
            <span className="flex h-5 w-5 items-center justify-center">
              {hasActive ? (
                <Loader2 className="h-4 w-4 animate-spin text-[#E879F9]" />
              ) : allSuccess ? (
                <Check className="h-4 w-4 text-emerald-300" />
              ) : (
                <BrainCircuit className="h-4 w-4 text-zinc-500" />
              )}
            </span>
            <span className="text-[13px] font-black tracking-tight text-zinc-100">{title}</span>
          </span>

          <span className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200">
            {isMainExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </span>
        </button>

        <div
          className={`grid bg-[#1A1A1A] transition-[grid-template-rows,opacity] duration-300 ease-out ${
            isMainExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <div className="flex flex-col px-4 pb-1 pt-4">
              {steps.map((step, index) => {
                const isLast = index === steps.length - 1;
                const isStepExpanded = expandedSteps[step.id] === true;

                return (
                  <div
                    key={step.id}
                    className={`relative flex gap-3.5 transition-opacity duration-300 ${
                      step.status === 'pending' ? 'opacity-50' : 'opacity-100'
                    }`}
                  >
                    {!isLast && (
                      <span className="absolute bottom-[-8px] left-[11px] top-7 z-0 w-px bg-white/[0.08]" />
                    )}

                    <span className="relative z-10 mt-0.5 h-6 w-6 flex-none">
                      <span className={`flex h-full w-full items-center justify-center rounded-full ring-4 ring-[#1A1A1A] ${statusClasses[step.status]}`}>
                        {step.status === 'success' ? (
                          step.icon || <Check className="h-3.5 w-3.5" />
                        ) : step.status === 'active' ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : step.status === 'error' ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          step.icon || <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        )}
                      </span>
                    </span>

                    <div className="min-w-0 flex-1 pb-5">
                      <button
                        type="button"
                        disabled={!step.content}
                        onClick={(event) => step.content && toggleStep(step.id, event)}
                        aria-expanded={step.content ? isStepExpanded : undefined}
                        className={`group -mx-2 flex w-[calc(100%_+_16px)] items-center justify-between rounded-lg px-2 py-1 text-left ${
                          step.content ? 'hover:bg-white/[0.035]' : 'cursor-default'
                        }`}
                      >
                        <span className={`min-w-0 text-[12px] tracking-tight ${
                          step.status === 'active'
                            ? 'font-black text-white'
                            : step.status === 'error'
                              ? 'font-bold text-rose-300'
                              : 'font-bold text-zinc-400'
                        }`}>
                          {step.title}
                        </span>

                        <span className="ml-3 flex flex-none items-center gap-2">
                          {step.duration && (
                            <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-zinc-600">
                              {step.duration}
                            </span>
                          )}
                          {step.content && (
                            <span className="text-zinc-600 transition-colors group-hover:text-zinc-400">
                              {isStepExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </span>
                          )}
                        </span>
                      </button>

                      {step.content && (
                        <div className={`grid transition-[grid-template-rows,opacity,margin] duration-300 ease-out ${
                          isStepExpanded ? 'mt-1 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
                        }`}>
                          <div className="overflow-hidden">
                            <div className="pb-1 pt-1">{step.content}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgentPlanning;
