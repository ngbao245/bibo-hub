// ============================================================
// CampaignCreate — 4-step wizard (Gmail API version)
// ============================================================
// Features:
//  - Autosave draft vào localStorage mỗi 3s
//  - Preview real-time với lead dropdown
//  - Variable warning (detect {{invalid}})
//  - Progress overlay khi Sending (poll campaigns.detail every 2s)
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState, LoadingState } from '@/components/shared';
import CampaignStepper from '@/components/agency-studio/CampaignStepper';
import { VariableWarnings, extractInvalidVars } from '@/components/agency-studio/VariableWarnings';
import { useAgencyStudioStore } from '@/stores/agencyStudioStore';
import { useTemplatesQuery, renderTemplate } from '@/api/agency-studio/templates';
import { useLeadsQuery } from '@/api/agency-studio/leads';
import {
  useCreateCampaignMutation,
  useSendCampaignMutation,
  useCampaignDetailQuery,
} from '@/api/agency-studio/campaigns';
import { Users, FileText } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authClient } from '@/lib/authClient';

/** Check if Gmail is connected — staleTime=0 để mount luôn refetch,
 *  tránh stale sau OAuth callback ở Settings. */
function useGmailConnected() {
  return useQuery({
    queryKey: ['agency_gmail_status'],
    queryFn: async () => {
      const { data } = await authClient
        .from('agency_user_settings')
        .select('gmail_email, gmail_connected')
        .maybeSingle();
      return { gmail_email: data?.gmail_email ?? null, gmail_connected: data?.gmail_connected ?? false };
    },
    retry: 2,
    retryDelay: 500,
    staleTime: 0,
  });
}

export default function CampaignCreate() {
  const navigate = useNavigate();
  const { wizardStep, draftCampaign, setWizardStep, updateDraftCampaign, resetWizard } =
    useAgencyStudioStore();

  const qc = useQueryClient();
  const templatesQuery = useTemplatesQuery();
  const leadsQuery = useLeadsQuery({ search: '', status: '', tags: [] }, 0);
  const createMut = useCreateCampaignMutation();
  const sendMut = useSendCampaignMutation();
  const gmailQuery = useGmailConnected();

  // Progress polling khi Sending
  const [sendingCampaignId, setSendingCampaignId] = useState<string | null>(null);
  const progressQuery = useCampaignDetailQuery(sendingCampaignId);

  // Invalidate gmail status khi mount — cover case user vừa OAuth ở
  // Settings quay lại wizard, cache có thể chưa refresh.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: ['agency_gmail_status'] });
  }, [qc]);

  const selectedTemplate = (templatesQuery.data ?? []).find((t) => t.id === draftCampaign.templateId);
  const eligibleLeads = (leadsQuery.data?.leads ?? []).filter((l) => !l.unsubscribed);
  const selectedEligibleLeads = eligibleLeads.filter((l) => draftCampaign.selectedLeadIds.includes(l.id));
  const gmailConnected = gmailQuery.data?.gmail_connected === true;

  // Preview lead dropdown: default first selected, user có thể chọn khác
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);
  useEffect(() => {
    if (!previewLeadId && selectedEligibleLeads.length > 0) {
      setPreviewLeadId(selectedEligibleLeads[0].id);
    }
    if (previewLeadId && !selectedEligibleLeads.find((l) => l.id === previewLeadId)) {
      setPreviewLeadId(selectedEligibleLeads[0]?.id ?? null);
    }
  }, [selectedEligibleLeads, previewLeadId]);

  const previewLead = selectedEligibleLeads.find((l) => l.id === previewLeadId);

  const invalidVars = useMemo(() => {
    if (!selectedTemplate) return [];
    return extractInvalidVars(selectedTemplate.subject, selectedTemplate.body);
  }, [selectedTemplate]);

  async function handleSend() {
    if (!gmailConnected) { toast.error('Kết nối Gmail trước. Vào Settings → Connect Gmail.'); return; }
    if (!draftCampaign.name.trim()) { toast.error('Nhập tên campaign'); return; }
    if (!draftCampaign.templateId) { toast.error('Chọn template'); return; }
    if (!draftCampaign.selectedLeadIds.length) { toast.error('Chọn ít nhất 1 lead'); return; }
    if (invalidVars.length > 0) {
      toast.error(`Template có biến không hợp lệ: ${invalidVars.join(', ')}. Sửa template trước khi gửi.`);
      return;
    }

    try {
      const campaign = await createMut.mutateAsync({
        name: draftCampaign.name,
        description: draftCampaign.description || undefined,
        template_id: draftCampaign.templateId,
      });

      setSendingCampaignId(campaign.id);

      await sendMut.mutateAsync({
        campaign_id: campaign.id,
        lead_ids: draftCampaign.selectedLeadIds,
      });

      toast.success(`Campaign đã gửi tới ${draftCampaign.selectedLeadIds.length} leads`);
      resetWizard();
      navigate('/agency-studio/campaigns');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gửi campaign thất bại';
      if (msg.includes('aborted') || msg.includes('timeout')) {
        toast.error('Timeout — check trạng thái campaign trong list');
      } else {
        toast.error(msg);
      }
      setSendingCampaignId(null);
    }
  }

  const isPending = createMut.isPending || sendMut.isPending;

  // Progress calc từ poll query
  const progressData = progressQuery.data;
  const totalToSend = draftCampaign.selectedLeadIds.length;
  const sentCount = progressData?.sent_count ?? 0;
  const failedCount = progressData?.failed_count ?? 0;
  const progressPct = totalToSend > 0 ? Math.round(((sentCount + failedCount) / totalToSend) * 100) : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" onClick={() => navigate('/agency-studio/campaigns')} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-sm font-semibold">New Campaign</h1>
      </div>

      {/* Stepper */}
      <div className="border-b border-border px-4 py-4">
        <CampaignStepper currentStep={wizardStep} />
      </div>

      {/* Gmail warning */}
      {!gmailQuery.isLoading && gmailQuery.isFetched && !gmailConnected && (
        <div className="border-b border-warning/30 bg-warning/10 px-4 py-2 text-xs text-warning">
          Gmail chưa kết nối. Vào Settings → Connect Gmail trước khi gửi.
        </div>
      )}

      {/* Progress overlay khi Sending */}
      {isPending && sendingCampaignId && (
        <div className="border-b border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-foreground">
              Đang gửi: {sentCount}/{totalToSend}
              {failedCount > 0 && <span className="ml-2 text-destructive">({failedCount} fail)</span>}
            </span>
            <span className="text-muted-foreground">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded bg-muted">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Step content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-xl space-y-4">

          {/* Step 1: Info */}
          {wizardStep === 1 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Campaign Info</h2>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tên campaign *</label>
                <Input
                  value={draftCampaign.name}
                  onChange={(e) => updateDraftCampaign({ name: e.target.value })}
                  placeholder="Q3 Outreach — SaaS founders"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Description</label>
                <textarea
                  value={draftCampaign.description}
                  onChange={(e) => updateDraftCampaign({ description: e.target.value })}
                  placeholder="Mục tiêu, ghi chú..."
                  rows={3}
                  className="w-full resize-none border border-border bg-background px-3 py-2 text-xs focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* Step 2: Template */}
          {wizardStep === 2 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Chọn Template</h2>
              {templatesQuery.isLoading ? (
                <LoadingState variant="skeleton" count={3} layout="list" itemClassName="h-16 w-full" />
              ) : (templatesQuery.data ?? []).length === 0 ? (
                <EmptyState icon={FileText} title="Chưa có template" description="Tạo template trước khi tạo campaign." />
              ) : (
                <div className="space-y-2">
                  {(templatesQuery.data ?? []).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateDraftCampaign({ templateId: t.id })}
                      className={`w-full rounded border p-3 text-left transition-colors ${draftCampaign.templateId === t.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
                    >
                      <p className="text-sm font-medium text-foreground">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.subject}</p>
                    </button>
                  ))}
                </div>
              )}
              {selectedTemplate && (
                <VariableWarnings subject={selectedTemplate.subject} body={selectedTemplate.body} />
              )}
            </div>
          )}

          {/* Step 3: Leads */}
          {wizardStep === 3 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">
                Chọn Leads
                <span className="ml-2 text-xs text-muted-foreground">({draftCampaign.selectedLeadIds.length} đã chọn)</span>
              </h2>
              {leadsQuery.isLoading ? (
                <LoadingState variant="skeleton" count={5} layout="list" itemClassName="h-8 w-full" />
              ) : eligibleLeads.length === 0 ? (
                <EmptyState icon={Users} title="Không có lead nào" description="Thêm leads trước." />
              ) : (
                <div className="space-y-1">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={eligibleLeads.every((l) => draftCampaign.selectedLeadIds.includes(l.id))}
                      onChange={(e) => updateDraftCampaign({
                        selectedLeadIds: e.target.checked ? eligibleLeads.map((l) => l.id) : [],
                      })}
                    />
                    Chọn tất cả ({eligibleLeads.length})
                  </label>
                  {eligibleLeads.map((l) => (
                    <label key={l.id} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={draftCampaign.selectedLeadIds.includes(l.id)}
                        onChange={(e) => {
                          const ids = draftCampaign.selectedLeadIds;
                          updateDraftCampaign({
                            selectedLeadIds: e.target.checked
                              ? [...ids, l.id]
                              : ids.filter((x) => x !== l.id),
                          });
                        }}
                      />
                      <span className="text-foreground">{l.full_name}</span>
                      <span className="text-muted-foreground">{l.email}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Preview */}
          {wizardStep === 4 && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium">Preview & Send</h2>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Campaign: <strong className="text-foreground">{draftCampaign.name}</strong></p>
                <p>Template: <strong className="text-foreground">{selectedTemplate?.name ?? '—'}</strong></p>
                <p>Leads: <strong className="text-foreground">{draftCampaign.selectedLeadIds.length}</strong></p>
              </div>

              {selectedTemplate && invalidVars.length > 0 && (
                <VariableWarnings subject={selectedTemplate.subject} body={selectedTemplate.body} />
              )}

              {selectedTemplate && selectedEligibleLeads.length > 0 && (
                <>
                  {/* Preview lead dropdown */}
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground">Preview với lead:</label>
                    <select
                      value={previewLeadId ?? ''}
                      onChange={(e) => setPreviewLeadId(e.target.value || null)}
                      className="border border-border bg-background px-2 py-1 text-xs focus:outline-none"
                    >
                      {selectedEligibleLeads.map((l) => (
                        <option key={l.id} value={l.id}>{l.full_name} — {l.email}</option>
                      ))}
                    </select>
                  </div>

                  {previewLead && (
                    <div className="border border-border p-4 space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {renderTemplate(selectedTemplate.subject, {
                          name: previewLead.full_name,
                          first_name: previewLead.full_name.split(' ')[0],
                          email: previewLead.email,
                          company: previewLead.company ?? '',
                          phone: previewLead.phone ?? '',
                          website: previewLead.website ?? '',
                        })}
                      </p>
                      <hr className="border-border" />
                      <pre className="whitespace-pre-wrap text-xs text-foreground font-sans">
                        {renderTemplate(selectedTemplate.body, {
                          name: previewLead.full_name,
                          first_name: previewLead.full_name.split(' ')[0],
                          email: previewLead.email,
                          company: previewLead.company ?? '',
                          phone: previewLead.phone ?? '',
                          website: previewLead.website ?? '',
                        })}
                      </pre>
                    </div>
                  )}
                </>
              )}

              {selectedEligibleLeads.length === 0 && (
                <EmptyState icon={Users} title="Chưa có lead nào được chọn" description="Quay lại step 3 để chọn." compact />
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSend}
                  disabled={isPending || !gmailConnected || invalidVars.length > 0}
                  className="gap-1"
                >
                  {isPending ? (
                    <LoadingState variant="inline" label="Đang gửi..." />
                  ) : (
                    <><Send className="h-3.5 w-3.5" />Gửi ngay</>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-border px-6 py-3">
        <Button
          variant="outline"
          size="sm"
          disabled={isPending}
          onClick={() => {
            if (wizardStep > 1) {
              setWizardStep((wizardStep - 1) as 1 | 2 | 3 | 4 | 5);
            } else {
              resetWizard();
              navigate('/agency-studio/campaigns');
            }
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" />
          {wizardStep === 1 ? 'Huỷ' : 'Quay lại'}
        </Button>
        {wizardStep < 4 && (
          <Button
            size="sm"
            onClick={() => setWizardStep((wizardStep + 1) as 1 | 2 | 3 | 4 | 5)}
            disabled={
              (wizardStep === 1 && !draftCampaign.name.trim()) ||
              (wizardStep === 2 && !draftCampaign.templateId) ||
              (wizardStep === 3 && draftCampaign.selectedLeadIds.length === 0)
            }
          >
            Tiếp
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>

    </div>
  );
}