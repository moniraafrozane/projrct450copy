'use client';

import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Timeline } from "@/components/patterns/timeline";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { auditLogAPI, type AdminAuditLog } from "@/lib/api";

const AUDIT_LOG_PAGE_SIZE = 20;

type TimelineItem = {
  title: string;
  description: string;
  timestamp: string;
  status?: "pending" | "success" | "warning" | "danger";
};

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLogs, setTotalLogs] = useState(0);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        setLoading(true);
        const response = await auditLogAPI.getAuditLogs({
          limit: AUDIT_LOG_PAGE_SIZE,
          page,
        });
        setLogs(response.logs);
        setTotalPages(Math.max(1, response.pagination.pages));
        setTotalLogs(response.pagination.total);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch audit logs:', err);
        setError('Failed to load audit logs');
      } finally {
        setLoading(false);
      }
    };

    fetchAuditLogs();
  }, [page]);

  const timelineItems: TimelineItem[] = logs.map((log) => {
    const date = new Date(log.createdAt);
    const formattedDate = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    // Determine status color based on action
    let status: 'pending' | 'success' | 'warning' | 'danger' = 'success';
    if (log.action.includes('reject') || log.action.includes('delete')) {
      status = 'danger';
    } else if (log.action.includes('pending')) {
      status = 'pending';
    }

    return {
      title: `${log.actorName || log.actorEmail} ${log.action.replace(/_/g, ' ').toLowerCase()}`,
      description: `Module: ${log.module} • ${log.description || `Resource: ${log.resourceName || log.resourceId || 'N/A'}`}`,
      timestamp: `${formattedDate} · ${formattedTime}`,
      status,
    };
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title="Audit trail"
        description="Complete action log with name, actor and Date & Time for every admin activity."
      />

      <SectionCard 
        title="Recent actions" 
        description="Export-ready evidence for compliance teams."
      >
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Loading audit logs...
          </div>
        ) : error ? (
          <div className="py-8 text-center text-destructive">
            {error}
          </div>
        ) : timelineItems.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            No audit logs found
          </div>
        ) : (
          <Timeline items={timelineItems} />
        )}

        {!loading && !error && timelineItems.length > 0 && (
          <div className="mt-4 flex items-center justify-between pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p - 1)}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {totalLogs} actions total
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => p + 1)}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
