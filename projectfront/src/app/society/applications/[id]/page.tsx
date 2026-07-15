'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageHeader } from '@/components/patterns/page-header';
import { SectionCard } from '@/components/patterns/section-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { applicationAPI, SocietyApplication, ApplicationStatus } from '@/lib/api';

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
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [application, setApplication] = useState<SocietyApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    applicationAPI
      .getApplicationById(id)
      .then((res) => {
        setApplication(res.application);
      })
      .catch(() => {
        setError('Failed to load application details.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="container py-8">
        <PageHeader
          title="Loading..."
          description="Fetching application details"
        />
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="container py-8">
        <PageHeader
          title="Error"
          description={error || 'Application not found'}
        />
        <Button onClick={() => router.back()} className="mt-4">
          Go Back
        </Button>
      </div>
    );
  }

  const meta = statusMeta[application.status] || { label: 'Unknown', variant: 'default' as const };

  // Render content based on application type
  const renderContent = () => {
    if (!application.content) {
      return <p className="text-muted-foreground">No content available</p>;
    }

    if (application.type === 'budget_breakdown') {
      return (
        <div className="space-y-6">
          {/* Event Info */}
          {application.content.eventTitle && (
            <div>
              <h4 className="font-semibold mb-2">Event</h4>
              <p className="text-sm text-muted-foreground">{application.content.eventTitle}</p>
            </div>
          )}

          {/* Budget Sections */}
          {application.content.sections && Array.isArray(application.content.sections) && (
            <div>
              <h4 className="font-semibold mb-4">Budget Breakdown</h4>
              <div className="space-y-4">
                {application.content.sections.map(
                  (section: any, idx: number) => (
                    <div key={idx} className="border rounded p-4 bg-muted/30">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Category</p>
                          <p className="font-medium">{section.category}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Description</p>
                          <p className="font-medium">{section.description}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Budget Amount</p>
                          <p className="font-medium">Rs. {section.budgetAmount?.toLocaleString() || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Spent Amount</p>
                          <p className="font-medium">Rs. {section.spentAmount?.toLocaleString() || 0}</p>
                        </div>
                      </div>
                      {section.justification && (
                        <div className="mt-3">
                          <p className="text-xs text-muted-foreground">Justification</p>
                          <p className="text-sm">{section.justification}</p>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Total Budget */}
          {application.content.totalBudget && (
            <div className="border-t pt-4">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total Budget Requested:</span>
                <span className="text-lg font-bold">
                  Rs. {application.content.totalBudget.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          {/* Justification */}
          {application.content.justification && (
            <div>
              <h4 className="font-semibold mb-2">Overall Justification</h4>
              <p className="text-sm whitespace-pre-wrap">{application.content.justification}</p>
            </div>
          )}
        </div>
      );
    }

    // Generic content display for other types
    return (
      <div className="space-y-4">
        {Object.entries(application.content).map(([key, value]) => (
          <div key={key}>
            <h4 className="font-semibold capitalize mb-2">
              {key.replace(/([A-Z])/g, ' $1').trim()}
            </h4>
            {typeof value === 'object' ? (
              <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-64">
                {JSON.stringify(value, null, 2)}
              </pre>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{String(value)}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          ← Back
        </Button>
      </div>

      <PageHeader
        title={application.subject}
        description={`${typeLabels[application.type] || application.type} • ${meta.label}`}
      />

      {/* Status & Metadata */}
      <SectionCard title='Application Overview'>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium">{typeLabels[application.type] || application.type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created By</p>
            <p className="font-medium">{application.createdByName}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm">{formatDate(application.createdAt)}</p>
          </div>
        </div>
      </SectionCard>

      {/* Content Section */}
      <SectionCard title="Application Details">
        {renderContent()}
      </SectionCard>

      {/* Admin Notes */}
      {application.adminNotes && (
        <SectionCard title="Admin Notes" >
          <p className="text-sm whitespace-pre-wrap">{application.adminNotes}</p>
        </SectionCard>
      )}

      {/* Member Notes */}
      <SectionCard title="Member Notes">
        {application.memberNotes && application.memberNotes.length > 0 ? (
          <div className="space-y-4">
            {application.memberNotes.map((note, idx) => (
              <div key={idx} className="border-l-4 border-primary pl-4 py-2">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-medium text-sm">{note.authorName}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(note.createdAt)}</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No member notes yet</p>
        )}
      </SectionCard>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          Go Back
        </Button>
      </div>
    </div>
  );
}
