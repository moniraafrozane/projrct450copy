"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { postEventAPI } from "@/lib/postEventApi";

function getReportId(reportIdParam: string | string[] | undefined): string | null {
  if (Array.isArray(reportIdParam)) return reportIdParam[0] ?? null;
  return reportIdParam ?? null;
}

export default function AdminPostEventReportPdfPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const reportId = getReportId(params?.reportId as string | string[] | undefined);
  const eventId = searchParams.get("eventId") || "";

  const [pdfUrl, setPdfUrl] = useState("");
  const [fileName, setFileName] = useState("post-event-report.pdf");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    const loadPdf = async () => {
      if (!reportId) {
        setError("Invalid report id.");
        setLoading(false);
        return;
      }

      if (!eventId) {
        setError("Missing event id. Please open this report from Financial Records.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await postEventAPI.getReportPdfFile(eventId, reportId);
        if (!active) return;
        objectUrl = URL.createObjectURL(response.blob);
        setPdfUrl(objectUrl);
        setFileName(response.fileName);
      } catch (loadError: any) {
        if (!active) return;
        setError(loadError.response?.data?.message || "Failed to load report PDF.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [eventId, reportId]);

  const handleDownload = async () => {
    if (!pdfUrl) return;
    setDownloading(true);
    try {
      const anchor = document.createElement("a");
      anchor.href = pdfUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!pdfUrl) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("Popup was blocked. Please allow popups and try again.");
      return;
    }

    try {
      setPrinting(true);
      setError("");
      printWindow.location.href = pdfUrl;
      printWindow.addEventListener(
        "load",
        () => {
          printWindow.focus();
          printWindow.print();
        },
        { once: true }
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Post-event report PDF"
        description="Submitted post-event reports are available to admins in PDF form."
        actions={[
          { label: "Back to financial records", href: "/admin/financial-records", variant: "outline" },
          reportId && eventId
            ? {
                label: "Open detailed view",
                href: `/admin/post-event-reports/${reportId}?eventId=${encodeURIComponent(eventId)}`,
                variant: "outline",
              }
            : { label: "Open detailed view", href: "/admin/financial-records", variant: "outline" },
        ]}
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionCard
        title="Report document"
        description="Preview, download, or print the submitted post-event report PDF."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        ) : !pdfUrl ? (
          <p className="text-sm text-muted-foreground">PDF preview is unavailable.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} disabled={downloading}>
                {downloading ? "Downloading..." : "Download PDF"}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={printing}>
                {printing ? "Preparing print..." : "Print PDF"}
              </Button>
            </div>

            <iframe
              title="Post-event report PDF preview"
              src={pdfUrl}
              className="h-[78vh] w-full rounded-xl border border-border/70"
            />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
