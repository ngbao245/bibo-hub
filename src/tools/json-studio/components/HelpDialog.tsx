import { Fragment } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getTab, type StudioTabId } from '@/tools/json-studio/lib/tabs';
import { HELP } from '@/tools/json-studio/lib/help-content';

// ============================================================
// HelpDialog — hướng dẫn chi tiết cho tab đang chọn
// ============================================================
//
// Focused mode: chỉ hiện help cho `activeTab`. User muốn xem tool khác thì
// click chip switch ở top dialog (không đóng dialog).
// ============================================================

interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: StudioTabId;
}

export function HelpDialog({ open, onOpenChange, activeTab }: HelpDialogProps) {
  const currentTab = getTab(activeTab);
  const help = HELP[activeTab];
  const Icon = currentTab.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <span>{currentTab.label}</span>
          </DialogTitle>
          <DialogDescription>{help.what}</DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-4 text-sm">
          <Section title="Dùng khi">
            <ul className="ml-4 list-disc space-y-1 text-foreground/80">
              {help.whenToUse.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </Section>

          <Section title="Cách dùng">
            <ol className="ml-4 list-decimal space-y-1 text-foreground/80">
              {help.howToUse.map((h, i) => (
                <li key={i}>{h}</li>
              ))}
            </ol>
          </Section>

          {help.examples.length > 0 && (
            <Section title="Ví dụ">
              <div className="space-y-3">
                {help.examples.map((ex, i) => (
                  <div key={i} className="border border-border bg-card/50 p-2.5">
                    <div className="mb-1.5 text-xs font-medium text-foreground">{ex.title}</div>
                    {ex.input && (
                      <div className="mb-1.5">
                        <div className="mb-0.5 text-[10px] uppercase text-muted-foreground">
                          Input
                        </div>
                        <pre className="whitespace-pre-wrap break-all bg-muted/50 p-2 font-mono text-[11px] text-foreground/90">
                          {ex.input}
                        </pre>
                      </div>
                    )}
                    {ex.output && (
                      <div className="mb-1.5">
                        <div className="mb-0.5 text-[10px] uppercase text-muted-foreground">
                          Output
                        </div>
                        <pre className="whitespace-pre-wrap break-all bg-success/10 p-2 font-mono text-[11px] text-foreground/90">
                          {ex.output}
                        </pre>
                      </div>
                    )}
                    {ex.note && (
                      <p className="text-xs italic text-muted-foreground">{ex.note}</p>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {help.cheatsheet && (
            <Section title="Cheatsheet">
              <div className="grid grid-cols-1 gap-1 border border-border bg-muted/30 p-2 text-xs sm:grid-cols-2">
                {help.cheatsheet.map((c, i) => (
                  <Fragment key={i}>
                    <div className="flex items-baseline gap-2 px-1 py-0.5">
                      <code className="shrink-0 bg-background px-1.5 py-0.5 font-mono text-[11px] text-primary">
                        {c.label}
                      </code>
                      <span className="text-muted-foreground">{c.meaning}</span>
                    </div>
                  </Fragment>
                ))}
              </div>
            </Section>
          )}

          <Section title="Tips">
            <ul className="space-y-1.5">
              {help.tips.map((tip, i) => (
                <li
                  key={i}
                  className="border-l-2 border-primary/50 bg-primary/5 px-2 py-1 text-xs text-foreground/80"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </Section>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}