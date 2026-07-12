// ============================================================
// CampaignStepper — 5-step progress indicator
// ============================================================

import { cn } from '@/lib/cn';

const STEPS = ['Info', 'Template', 'Leads', 'Preview', 'Send'] as const;

interface Props {
  currentStep: 1 | 2 | 3 | 4 | 5;
}

export default function CampaignStepper({ currentStep }: Props) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((label, idx) => {
        const step = (idx + 1) as 1 | 2 | 3 | 4 | 5;
        const isDone = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                  isDone && 'bg-primary text-primary-foreground',
                  isActive && 'border-2 border-primary text-primary',
                  !isDone && !isActive && 'border border-border text-muted-foreground',
                )}
              >
                {isDone ? '✓' : step}
              </div>
              <span
                className={cn(
                  'text-xs',
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground',
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'mx-1 mb-5 h-px w-8',
                  step < currentStep ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}