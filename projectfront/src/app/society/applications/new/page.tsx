'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/patterns/page-header';
import { SectionCard } from '@/components/patterns/section-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { applicationAPI, ApplicationType } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type FundWithdrawalContent = {
  applicationDate: string;
  recipientTitle: string;
  throughTitle: string;
  eventDate: string;
  eventTitle: string;
  chiefGuestName: string;
  chiefGuestDesignation: string;
  chiefGuestOrganization: string;
  amount: string;
  usedFor: string;
  applicantName: string;
  applicantPosition: string;
  registrationNumber: string;
  phoneNumber: string;
  attachments: string;
};

type EventApprovalContent = {
  applicationDate: string;
  eventTitle: string;
  proposedDate: string;
  venue: string;
  expectedAttendees: string;
  description: string;
  budget: string;
  applicantName: string;
  applicantPosition: string;
  registrationNumber: string;
  phoneNumber: string;
};

type ResourceRequestContent = {
  applicationDate: string;
  resourceType: string;
  quantity: string;
  purpose: string;
  duration: string;
  eventReference: string;
  applicantName: string;
  applicantPosition: string;
  registrationNumber: string;
  phoneNumber: string;
};

type FormContent = FundWithdrawalContent | EventApprovalContent | ResourceRequestContent;

// ─── Default values ───────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];

const defaultFundWithdrawal: FundWithdrawalContent = {
  applicationDate: today,
  recipientTitle: 'The President',
  throughTitle: 'The Treasurer',
  eventDate: '',
  eventTitle: '',
  chiefGuestName: '',
  chiefGuestDesignation: '',
  chiefGuestOrganization: '',
  amount: '',
  usedFor: '',
  applicantName: '',
  applicantPosition: '',
  registrationNumber: '',
  phoneNumber: '',
  attachments: 'Receipts of the expenses.',
};

const defaultEventApproval: EventApprovalContent = {
  applicationDate: today,
  eventTitle: '',
  proposedDate: '',
  venue: '',
  expectedAttendees: '',
  description: '',
  budget: '',
  applicantName: '',
  applicantPosition: '',
  registrationNumber: '',
  phoneNumber: '',
};

const defaultResourceRequest: ResourceRequestContent = {
  applicationDate: today,
  resourceType: '',
  quantity: '',
  purpose: '',
  duration: '',
  eventReference: '',
  applicantName: '',
  applicantPosition: '',
  registrationNumber: '',
  phoneNumber: '',
};

const selectableApplicationTypes: ApplicationType[] = ['fund_withdrawal', 'event_approval'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '___________';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function buildSubject(type: ApplicationType, content: Record<string, string>): string {
  if (type === 'fund_withdrawal') {
    const title = content.eventTitle || 'the event';
    return `Application for withdrawal of allocated funds for ${title}`;
  }
  if (type === 'event_approval') {
    const title = content.eventTitle || 'the proposed event';
    return `Application for approval of ${title}`;
  }
  if (type === 'budget_breakdown') {
    const title = content.eventTitle || 'the event';
    return `Budget breakdown for ${title}`;
  }
  return `Request for resource allocation – ${content.resourceType || 'items'}`;
}

// ─── Letter Preview ───────────────────────────────────────────────────────────

function LetterPreview({
  type,
  content,
}: {
  type: ApplicationType;
  content: Record<string, string>;
}) {
  const fw = content as FundWithdrawalContent;
  const ea = content as EventApprovalContent;
  const rr = content as ResourceRequestContent;

  const renderBody = () => {
    if (type === 'fund_withdrawal') {
      return (
        <>
          <p className="mb-4">Sir,</p>
          <p className="mb-4 text-justify">
            With due respect, I would like to state that on{' '}
            <strong>{formatDate(fw.eventDate)}</strong>, a{' '}
            {fw.eventTitle ? (
              <>
                seminar on <strong>"{fw.eventTitle}"</strong>
              </>
            ) : (
              'seminar/event'
            )}{' '}
            was organized by the CSE Society.
            {fw.chiefGuestName && (
              <>
                {' '}The chief guest of the seminar was{' '}
                <strong>{fw.chiefGuestName}</strong>
                {fw.chiefGuestDesignation && `, ${fw.chiefGuestDesignation}`}
                {fw.chiefGuestOrganization && ` at ${fw.chiefGuestOrganization}`}.
              </>
            )}{' '}
            A total of{' '}
            <strong>{fw.amount ? `${fw.amount} BDT` : '___ BDT'}</strong> was
            used to buy {fw.usedFor || '___________'} which need to be withdrawn.
          </p>
          <p className="mb-6 text-justify">
            Therefore, I humbly request you to kindly grant me permission to withdraw
            the said amount from the approved budget.
          </p>
        </>
      );
    }

    if (type === 'event_approval') {
      return (
        <>
          <p className="mb-4">Sir/Madam,</p>
          <p className="mb-4 text-justify">
            With due respect, I would like to seek approval for the event{' '}
            <strong>"{ea.eventTitle || '___________'}"</strong> proposed to be held on{' '}
            <strong>{formatDate(ea.proposedDate)}</strong> at{' '}
            <strong>{ea.venue || '___________'}</strong>.
            {ea.expectedAttendees && (
              <> The expected number of attendees is <strong>{ea.expectedAttendees}</strong>.</>
            )}
            {ea.description && (
              <>
                <br />
                <br />
                {ea.description}
              </>
            )}
            {ea.budget && (
              <> An estimated budget of <strong>{ea.budget} BDT</strong> is required for this purpose.</>
            )}
          </p>
          <p className="mb-6 text-justify">
            I humbly request your kind approval and necessary support for the successful
            organizing of the event.
          </p>
        </>
      );
    }

    // resource_request
    return (
      <>
        <p className="mb-4">Sir/Madam,</p>
        <p className="mb-4 text-justify">
          With due respect, I would like to request the allocation of{' '}
          <strong>{rr.quantity ? `${rr.quantity} unit(s) of ` : ''}</strong>
          <strong>{rr.resourceType || '___________'}</strong>
          {rr.purpose && ` for ${rr.purpose}`}
          {rr.duration && `, for a duration of ${rr.duration}`}
          {rr.eventReference && `, in relation to the event: ${rr.eventReference}`}.
        </p>
        <p className="mb-6 text-justify">
          I humbly request you to kindly arrange the said resource at your earliest convenience.
        </p>
      </>
    );
  };

  const hasThroughLine =
    type === 'fund_withdrawal' && fw.throughTitle && fw.throughTitle !== 'None';

  const renderAttachments = () => {
    if (type === 'fund_withdrawal' && fw.attachments) {
      return (
        <div className="mt-6">
          <p className="font-semibold">Attachment:</p>
          <p>1. {fw.attachments}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl border border-border/70 bg-white p-8 font-serif text-sm text-gray-900 shadow-sm dark:bg-gray-950 dark:text-gray-100 print:shadow-none">
      {/* Date */}
      <p className="mb-6">
        <strong>Date:</strong> {formatDate(content.applicationDate || today)}
      </p>

      {/* Recipient */}
      <div className="mb-4">
        <p>To</p>
        <p>{content.recipientTitle || 'The President'},</p>
        <p>CSE Society, SUST, Sylhet</p>
      </div>

      {/* Through (optional) */}
      {hasThroughLine && (
        <div className="mb-4">
          <p>Through</p>
          <p>{fw.throughTitle},</p>
          <p>CSE Society, SUST, Sylhet</p>
        </div>
      )}

      {/* Subject */}
      <p className="mb-6 font-bold underline">
        <strong>Subject:</strong>{' '}
        {buildSubject(type, content as Record<string, string>)}.
      </p>

      {/* Body */}
      {renderBody()}

      {/* Sign-off */}
      <p className="mb-8">Sincerely,</p>

      <div className="space-y-1">
        <p className="font-semibold">{content.applicantName || '___________'}</p>
        <p>
          {content.applicantPosition ? `${content.applicantPosition}, ` : ''}CSE Society, SUST
        </p>
        {content.registrationNumber && (
          <p>Registration No.: {content.registrationNumber}</p>
        )}
        {content.phoneNumber && <p>Phone No: {content.phoneNumber}</p>}
      </div>

      {renderAttachments()}
    </div>
  );
}

// ─── Field components (module-level so their identity is stable across renders) ─

function Field({
  label,
  name,
  type: inputType = 'text',
  placeholder,
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={inputType}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function TextAreaField({
  label,
  name,
  placeholder,
  rows = 3,
  value,
  onChange,
}: {
  label: string;
  name: string;
  placeholder?: string;
  rows?: number;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Textarea
        id={name}
        name={name}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required,
  value,
  onChange,
}: {
  label: string;
  name: string;
  options: string[];
  required?: boolean;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        className="flex h-11 w-full rounded-2xl border border-input bg-background px-4 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function GenerateApplicationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftId = searchParams.get('draft');

  const [type, setType] = useState<ApplicationType>('fund_withdrawal');
  const [content, setContent] = useState<FormContent>(defaultFundWithdrawal);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingDraft, setLoadingDraft] = useState(!!draftId);

  const pdfDownloadSupported = type === 'fund_withdrawal' || type === 'event_approval';

  // Load existing draft when ?draft= param is present
  useEffect(() => {
    if (!draftId) return;
    applicationAPI
      .getApplicationById(draftId)
      .then((res) => {
        const app = res.application;
        setSavedId(app.id);
        setType(app.type);
        setContent(app.content as FormContent);
      })
      .catch(() => setError('Could not load the draft.'))
      .finally(() => setLoadingDraft(false));
  }, [draftId]);

  // Switch type → reset content to defaults
  const handleTypeChange = (newType: ApplicationType) => {
    setType(newType);
    setSavedId(null);
    setSaveMessage('');
    setError('');
    if (newType === 'fund_withdrawal') setContent(defaultFundWithdrawal);
    else if (newType === 'event_approval') setContent(defaultEventApproval);
    else if (newType === 'budget_breakdown') setContent(defaultEventApproval);
    else setContent(defaultResourceRequest);
  };

  const handleFieldChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setContent((prev) => ({ ...prev, [name]: value }));
      setSaveMessage('');
    },
    []
  );

  const subject = buildSubject(type, content as Record<string, string>);

  // ── Save Draft ─────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    setSaving(true);
    setError('');
    setSaveMessage('');
    try {
      const payload = {
        type,
        subject,
        content: content as Record<string, string>,
      };

      if (savedId) {
        await applicationAPI.updateApplication(savedId, payload);
        setSaveMessage('Draft updated successfully.');
      } else {
        const res = await applicationAPI.createApplication(payload);
        if (res.application?.id) {
          setSavedId(res.application.id);
        }
        setSaveMessage('Draft saved successfully.');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to save draft.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Send to Admin ──────────────────────────────────────────────────
  const handleSendToAdmin = async () => {
    setSubmitting(true);
    setError('');
    try {
      let id = savedId;

      // Auto-save first if not yet saved
      if (!id) {
        const res = await applicationAPI.createApplication({
          type,
          subject,
          content: content as Record<string, string>,
        });
        id = res.application?.id ?? null;
        if (id) setSavedId(id);
      } else {
        // Push latest edits before submitting
        await applicationAPI.updateApplication(id, {
          type,
          subject,
          content: content as Record<string, string>,
        });
      }

      if (!id) throw new Error('Could not save application before submitting.');

      await applicationAPI.submitApplication(id);
      router.push('/society/applications');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to send application.';
      setError(msg);
      setSubmitting(false);
    }
  };

  // ── Download PDF ───────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (!pdfDownloadSupported) {
      setError('PDF download is currently available for fund withdrawal and event approval only.');
      return;
    }

    setDownloading(true);
    setError('');
    setSaveMessage('');

    try {
      let id = savedId;

      // Ensure there is a stored application before requesting the PDF.
      if (!id) {
        const res = await applicationAPI.createApplication({
          type,
          subject,
          content: content as Record<string, string>,
        });
        id = res.application?.id ?? null;
        if (id) {
          setSavedId(id);
          setSaveMessage('Draft saved successfully.');
        }
      } else {
        // Save latest edits before download so PDF matches current form values.
        await applicationAPI.updateApplication(id, {
          type,
          subject,
          content: content as Record<string, string>,
        });
        setSaveMessage('Draft updated successfully.');
      }

      if (!id) {
        throw new Error('Could not save application before downloading.');
      }

      const pdfRes = await applicationAPI.getApplicationPdfFile(id, { download: true });
      const objectUrl = URL.createObjectURL(pdfRes.blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = pdfRes.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Failed to download application PDF.';
      setError(msg);
    } finally {
      setDownloading(false);
    }
  };

  // ─── Render form sections per type ─────────────────────────────────────────

  const renderFormFields = () => {
    const v = (n: string) => (content as Record<string, string>)[n] ?? '';
    if (type === 'fund_withdrawal') {
      return (
        <div className="space-y-6">
          {/* Meta */}
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Application Date" name="applicationDate" type="date" required value={v('applicationDate')} onChange={handleFieldChange} />
            <SelectField
              label="Addressed To"
              name="recipientTitle"
              options={['The President', 'The Vice-President', 'The General Secretary', 'The Treasurer']}
              required
              value={v('recipientTitle')}
              onChange={handleFieldChange}
            />
          </div>
          <SelectField
            label="Through (optional)"
            name="throughTitle"
            options={['None', 'The President', 'The Vice-President', 'The General Secretary', 'The Treasurer']}
            value={v('throughTitle')}
            onChange={handleFieldChange}
          />

          {/* Event info */}
          <div className="border-t border-border/50 pt-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Event Details
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Event Date" name="eventDate" type="date" required value={v('eventDate')} onChange={handleFieldChange} />
              <Field
                label="Event Title / Topic"
                name="eventTitle"
                placeholder='e.g. "How AI is reshaping finance"'
                required
                value={v('eventTitle')}
                onChange={handleFieldChange}
              />
            </div>
          </div>

          {/* Chief guest */}
          <div className="grid gap-6 md:grid-cols-3">
            <Field label="Chief Guest Name" name="chiefGuestName" placeholder="Dr. John Doe" value={v('chiefGuestName')} onChange={handleFieldChange} />
            <Field
              label="Designation"
              name="chiefGuestDesignation"
              placeholder="Director of …"
              value={v('chiefGuestDesignation')}
              onChange={handleFieldChange}
            />
            <Field
              label="Organization"
              name="chiefGuestOrganization"
              placeholder="Facebook, Europe"
              value={v('chiefGuestOrganization')}
              onChange={handleFieldChange}
            />
          </div>

          {/* Financials */}
          <div className="border-t border-border/50 pt-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Fund Details
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Total Amount (BDT)" name="amount" type="number" placeholder="8100" required value={v('amount')} onChange={handleFieldChange} />
              <Field
                label="Used For"
                name="usedFor"
                placeholder="snacks, crest"
                required
                value={v('usedFor')}
                onChange={handleFieldChange}
              />
            </div>
          </div>

          {/* Applicant */}
          <div className="border-t border-border/50 pt-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Applicant Info
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Your Name" name="applicantName" placeholder="Imran Bin Azad" required value={v('applicantName')} onChange={handleFieldChange} />
              <Field label="Position" name="applicantPosition" placeholder="GS" required value={v('applicantPosition')} onChange={handleFieldChange} />
              <Field
                label="Registration Number"
                name="registrationNumber"
                placeholder="2020331101"
                value={v('registrationNumber')}
                onChange={handleFieldChange}
              />
              <Field label="Phone Number" name="phoneNumber" placeholder="01567893310" value={v('phoneNumber')} onChange={handleFieldChange} />
            </div>
            <div className="mt-4">
              <Field
                label="Attachment Note"
                name="attachments"
                placeholder="Receipts of the expenses."
                value={v('attachments')}
                onChange={handleFieldChange}
              />
            </div>
          </div>
        </div>
      );
    }

    if (type === 'event_approval') {
      return (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Application Date" name="applicationDate" type="date" required value={v('applicationDate')} onChange={handleFieldChange} />
            <Field label="Event Title" name="eventTitle" placeholder="Annual Tech Fest 2026" required value={v('eventTitle')} onChange={handleFieldChange} />
            <Field label="Proposed Date" name="proposedDate" type="date" required value={v('proposedDate')} onChange={handleFieldChange} />
            <Field label="Venue" name="venue" placeholder="CSE Building Auditorium" required value={v('venue')} onChange={handleFieldChange} />
            <Field label="Expected Attendees" name="expectedAttendees" placeholder="200" value={v('expectedAttendees')} onChange={handleFieldChange} />
            <Field label="Estimated Budget (BDT)" name="budget" type="number" placeholder="15000" value={v('budget')} onChange={handleFieldChange} />
          </div>
          <TextAreaField
            label="Event Description"
            name="description"
            placeholder="Brief description of the event, objectives, agenda…"
            rows={4}
            value={v('description')}
            onChange={handleFieldChange}
          />
          <div className="border-t border-border/50 pt-6">
            <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Applicant Info
            </p>
            <div className="grid gap-6 md:grid-cols-2">
              <Field label="Your Name" name="applicantName" placeholder="Imran Bin Azad" required value={v('applicantName')} onChange={handleFieldChange} />
              <Field label="Position" name="applicantPosition" placeholder="Event Secretary" required value={v('applicantPosition')} onChange={handleFieldChange} />
              <Field label="Registration Number" name="registrationNumber" placeholder="2020331101" value={v('registrationNumber')} onChange={handleFieldChange} />
              <Field label="Phone Number" name="phoneNumber" placeholder="01567893310" value={v('phoneNumber')} onChange={handleFieldChange} />
            </div>
          </div>
        </div>
      );
    }

    // resource_request
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Field label="Application Date" name="applicationDate" type="date" required value={v('applicationDate')} onChange={handleFieldChange} />
          <Field label="Resource Type" name="resourceType" placeholder="Projector, Microphone, Chairs…" required value={v('resourceType')} onChange={handleFieldChange} />
          <Field label="Quantity" name="quantity" placeholder="2" required value={v('quantity')} onChange={handleFieldChange} />
          <Field label="Duration Needed" name="duration" placeholder="3 days" value={v('duration')} onChange={handleFieldChange} />
          <Field
            label="Event Reference (if any)"
            name="eventReference"
            placeholder="Spring Seminar 2026"
            value={v('eventReference')}
            onChange={handleFieldChange}
          />
        </div>
        <TextAreaField
          label="Purpose"
          name="purpose"
          placeholder="Describe why these resources are needed…"
          rows={3}
          value={v('purpose')}
          onChange={handleFieldChange}
        />
        <div className="border-t border-border/50 pt-6">
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Applicant Info
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <Field label="Your Name" name="applicantName" placeholder="Imran Bin Azad" required value={v('applicantName')} onChange={handleFieldChange} />
            <Field label="Position" name="applicantPosition" placeholder="GS" required value={v('applicantPosition')} onChange={handleFieldChange} />
            <Field label="Registration Number" name="registrationNumber" placeholder="2020331101" value={v('registrationNumber')} onChange={handleFieldChange} />
            <Field label="Phone Number" name="phoneNumber" placeholder="01567893310" value={v('phoneNumber')} onChange={handleFieldChange} />
          </div>
        </div>
      </div>
    );
  };

  // ─── UI ─────────────────────────────────────────────────────────────────────

  const typeLabels: Record<ApplicationType, string> = {
    fund_withdrawal: 'Fund Withdrawal',
    event_approval: 'Event Approval',
    resource_request: 'Resource Request',
    budget_breakdown: 'Budget Breakdown',
  };

  return (
    <div className="space-y-8">
      {loadingDraft ? (
        <div className="py-20 text-center text-muted-foreground">Loading draft…</div>
      ) : (
        <>
      <PageHeader
        title="Generate Application"
        description="Fill in the form to compose a formal application letter."
        actions={[
          {
            label: '← Back to Applications',
            href: '/society/applications',
            variant: 'outline',
          },
        ]}
      />

      {/* Application Type Selector */}
      <SectionCard title="Application Type">
        <div className="flex flex-wrap gap-3">
          {selectableApplicationTypes.map(
            (t) => (
              <button
                key={t}
                onClick={() => handleTypeChange(t)}
                className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors ${
                  type === t
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-muted/60'
                }`}
              >
                {typeLabels[t]}
              </button>
            )
          )}
        </div>
      </SectionCard>

      {/* Two-column layout: Form | Preview */}
      <div className="grid gap-8 xl:grid-cols-2">
        {/* ── Form ───────────────────────────────────────────────────── */}
        <SectionCard
          title={`${typeLabels[type]} Form`}
          description="All starred fields are required."
        >
          {renderFormFields()}

          {/* Feedback */}
          {saveMessage && (
            <p className="mt-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
              {saveMessage}
            </p>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="mt-8 flex flex-wrap gap-3 border-t border-border/50 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saving || submitting}
            >
              {saving ? 'Saving…' : savedId ? 'Update Draft' : 'Save Draft'}
            </Button>
            <Button
              type="button"
              variant="accent"
              onClick={handleSendToAdmin}
              disabled={saving || submitting}
            >
              {submitting ? 'Sending…' : 'Send to Forwarding Board'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={saving || submitting || downloading || !pdfDownloadSupported}
            >
              {downloading ? 'Downloading…' : 'Download PDF'}
            </Button>
          </div>
        </SectionCard>

        {/* ── Live Letter Preview ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Letter Preview</h2>
              <p className="text-sm text-muted-foreground">Updates as you type</p>
            </div>
          </div>
          <LetterPreview type={type} content={content as Record<string, string>} />
        </div>
      </div>
        </>
      )}
    </div>
  );
}

export default function GenerateApplicationPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-muted-foreground">Loading…</div>}>
      <GenerateApplicationPageInner />
    </Suspense>
  );
}
