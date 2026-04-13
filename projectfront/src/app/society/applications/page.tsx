'use client';

import { useEffect, useRef, useState } from 'react';
import { PageHeader } from '@/components/patterns/page-header';
import { SectionCard } from '@/components/patterns/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { applicationAPI, MemberNote, SocietyApplication, ApplicationStatus } from '@/lib/api';

// Map backend status → display badge
const statusMeta: Record<
  ApplicationStatus,
  { label: string; variant: 'accent' | 'success' | 'warning' | 'destructive' | 'default' }
> = {
  draft: { label: 'Draft', variant: 'default' },
  submitted: { label: 'Review', variant: 'accent' },
  under_review: { label: 'Review', variant: 'accent' },
  approved: { label: 'Ready', variant: 'success' },
  returned: { label: 'Need change', variant: 'warning' },
};

const typeLabels: Record<string, string> = {
  fund_withdrawal: 'Fund Withdrawal',
  event_approval: 'Event Approval',
  resource_request: 'Resource Request',
  budget_breakdown: 'Budget Breakdown',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Inline Notes Panel ────────────────────────────────────────────────────────
function NotesPanel({
  appId,
  notes,
  onNoteAdded,
}: {
  appId: string;
  notes: MemberNote[];
  onNoteAdded: (appId: string, updatedNotes: MemberNote[]) => void;
}) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [noteError, setNoteError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setNoteError('');
    try {
      const res = await applicationAPI.addNote(appId, text.trim());
      onNoteAdded(appId, res.application.memberNotes ?? []);
      setText('');
    } catch {
      setNoteError('Failed to save note. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-2xl border border-border/50 bg-muted/30 p-4 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Member Notes
      </p>

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet. Be the first to add one.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n, i) => (
            <li key={i} className="rounded-xl border border-border/60 bg-background px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium text-foreground">{n.authorName}</span>
                <span className="text-xs text-muted-foreground">{formatDate(n.createdAt)}</span>
              </div>
              <p className="text-muted-foreground whitespace-pre-wrap">{n.text}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 items-start pt-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note for collaborators…"
          rows={2}
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <Button size="sm" onClick={handleAdd} disabled={saving || !text.trim()}>
          {saving ? 'Saving…' : 'Add'}
        </Button>
      </div>
      {noteError && <p className="text-xs text-destructive">{noteError}</p>}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SocietyApplicationsPage() {
  const [applications, setApplications] = useState<SocietyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null);
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState('');
  const [submitErrorMessage, setSubmitErrorMessage] = useState('');

  useEffect(() => {
    applicationAPI
      .getApplications()
      .then((res) => setApplications(res.applications))
      .catch(() => setError('Failed to load applications.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmitDraft = async (id: string) => {
    setSendingId(id);
    setSubmitSuccessMessage('');
    setSubmitErrorMessage('');
    try {
      await applicationAPI.submitApplication(id);
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'submitted' as ApplicationStatus } : a))
      );
      setSubmitSuccessMessage('Application is sent to admin successfully');
    } catch {
      setSubmitErrorMessage('Failed to send application to admin. Please try again.');
    } finally {
      setSendingId(null);
    }
  };

  const handleForwardToAdmin = async (id: string) => {
    setSendingId(id);
    setSubmitSuccessMessage('');
    setSubmitErrorMessage('');
    try {
      await applicationAPI.forwardApplication(id);
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'under_review' as ApplicationStatus } : a))
      );
      setSubmitSuccessMessage('successfully send the application ');
    } catch {
      setSubmitErrorMessage('Failed to forward application to admin. Please try again.');
    } finally {
      setSendingId(null);
    }
  };

  const handleNoteAdded = (appId: string, updatedNotes: MemberNote[]) => {
    setApplications((prev) =>
      prev.map((a) => (a.id === appId ? { ...a, memberNotes: updatedNotes } : a))
    );
  };

  const nonBudgetApplications = applications.filter((a) => a.type !== 'budget_breakdown');
  const drafts = nonBudgetApplications.filter((a) => a.status === 'draft');
  const queue = nonBudgetApplications.filter((a) => a.status !== 'draft');

  return (
    <div className="space-y-10">
      <PageHeader
        title="Event Applications"
        description="Create applications, and forward them to admins."
        actions={[
          {
            label: 'Generate application',
            href: '/society/applications/new',
            variant: 'accent',
          },
        ]}
      />

      {submitSuccessMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {submitSuccessMessage}
        </div>
      )}

      {submitErrorMessage && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {submitErrorMessage}
        </div>
      )}

      {/* ── Drafts ──────────────────────────────────────────────────────── */}
      {(loading || drafts.length > 0) && (
        <SectionCard
          title="Saved Drafts"
          description="Open drafts — any society member can edit or add notes before submitting."
        >
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="space-y-4">
              {drafts.map((app) => (
                <div key={app.id} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {typeLabels[app.type] ?? app.type}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{app.subject}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Created by {app.createdByName} · {formatDate(app.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(app.memberNotes?.length ?? 0) > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {app.memberNotes.length} note{app.memberNotes.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <Badge variant="default">Draft</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/society/applications/new?draft=${app.id}`}>Edit</a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNotesOpenId(notesOpenId === app.id ? null : app.id)}
                    >
                      {notesOpenId === app.id ? 'Hide notes' : 'Add / view notes'}
                    </Button>
                    <Button
                      size="sm"
                      disabled={sendingId === app.id}
                      onClick={() => handleSubmitDraft(app.id)}
                    >
                      {sendingId === app.id ? 'Sending…' : 'Send to Admin'}
                    </Button>
                  </div>
                  {notesOpenId === app.id && (
                    <NotesPanel
                      appId={app.id}
                      notes={app.memberNotes ?? []}
                      onNoteAdded={handleNoteAdded}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Forwarding Board ─────────────────────────────────────────────── */}
      <SectionCard
        title="Forwarding Board"
        description="Submitted applications — members can attach notes and forward to admin."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No submitted applications yet. Use Generate application to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {queue.map((app) => {
              const meta = statusMeta[app.status] ?? { label: app.status, variant: 'default' as const };
              return (
                <div key={app.id} className="rounded-2xl border border-border/70 p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">{app.createdByName}</p>
                      <p className="text-sm text-muted-foreground">
                        {typeLabels[app.type] ?? app.type} — {app.subject}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(app.memberNotes?.length ?? 0) > 0 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {app.memberNotes.length} note{app.memberNotes.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-sm text-muted-foreground">
                    <span>Received {formatDate(app.createdAt)}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setNotesOpenId(notesOpenId === app.id ? null : app.id)}
                    >
                      {notesOpenId === app.id ? 'Hide notes' : 'Add / view notes'}
                    </Button>
                    <Button variant="outline" size="sm">
                      Print
                    </Button>
                    {app.status === 'submitted' && (
                      <Button
                        size="sm"
                        disabled={sendingId === app.id}
                        onClick={() => handleForwardToAdmin(app.id)}
                      >
                        {sendingId === app.id ? 'Sending…' : 'Forward to admin'}
                      </Button>
                    )}
                  </div>
                  {app.status === 'returned' && app.adminNotes && (
                    <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
                      <p className="font-semibold">Returned note from admin</p>
                      <p className="mt-1 whitespace-pre-wrap">{app.adminNotes}</p>
                    </div>
                  )}
                  {notesOpenId === app.id && (
                    <NotesPanel
                      appId={app.id}
                      notes={app.memberNotes ?? []}
                      onNoteAdded={handleNoteAdded}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
