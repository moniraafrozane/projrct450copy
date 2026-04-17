"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { applicationAPI, type SocietyApplication } from "@/lib/api";

const PDF_SUPPORTED_TYPES = new Set(["fund_withdrawal", "event_approval"]);

function getIdFromParams(idParam: string | string[] | undefined): string | null {
  if (Array.isArray(idParam)) return idParam[0] ?? null;
  return idParam ?? null;
}

export default function AdminApplicationPdfPage() {
  const params = useParams();
  const id = getIdFromParams(params?.id as string | string[] | undefined);

  const [application, setApplication] = useState<SocietyApplication | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");

  const isSupportedType = useMemo(
    () => (application ? PDF_SUPPORTED_TYPES.has(application.type) : true),
    [application]
  );

  const getErrorMessage = (err: unknown, fallback: string) => {
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as { response?: unknown }).response === "object"
    ) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      if (response?.data?.message) {
        return response.data.message;
      }
    }

    return fallback;
  };

  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;

    const load = async () => {
      if (!id) {
        setError("Invalid application id.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const appRes = await applicationAPI.getApplicationById(id);
        if (!active) return;
        setApplication(appRes.application);

        if (!PDF_SUPPORTED_TYPES.has(appRes.application.type)) {
          setLoading(false);
          return;
        }

        const pdfRes = await applicationAPI.getApplicationPdfFile(id);
        if (!active) return;

        currentObjectUrl = URL.createObjectURL(pdfRes.blob);
        setPdfUrl(currentObjectUrl);
      } catch (loadError: unknown) {
        if (!active) return;
        setError(getErrorMessage(loadError, "Failed to load application PDF."));
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      active = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [id]);

  const handleDownload = async () => {
    if (!id || !isSupportedType) return;

    try {
      setDownloading(true);
      const pdfRes = await applicationAPI.getApplicationPdfFile(id, { download: true });
      const objectUrl = URL.createObjectURL(pdfRes.blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = pdfRes.fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError: unknown) {
      setError(getErrorMessage(downloadError, "Failed to download PDF."));
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = async () => {
    if (!id || !isSupportedType) return;

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("Popup was blocked. Please allow popups and try again.");
      return;
    }

    try {
      setPrinting(true);
      setError("");

      const pdfRes = await applicationAPI.getApplicationPrintFile(id);
      const objectUrl = URL.createObjectURL(pdfRes.blob);

      printWindow.location.href = objectUrl;
      printWindow.addEventListener(
        "load",
        () => {
          printWindow.focus();
          printWindow.print();
        },
        { once: true }
      );

      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 60_000);
    } catch (printError: unknown) {
      printWindow.close();
      setError(getErrorMessage(printError, "Failed to open printable PDF."));
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Application PDF"
        description="View the submitted application in formal letter format and download a copy."
        actions={[
          { label: "Back to admin dashboard", href: "/admin", variant: "outline" },
          { label: "Open review details", href: id ? `/admin/applications/${id}` : "/admin", variant: "outline" },
        ]}
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionCard
        title="Application document"
        description="This PDF mirrors the original letter-style application submitted by society members."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        ) : !application ? (
          <p className="text-sm text-muted-foreground">Application not found.</p>
        ) : !isSupportedType ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              PDF view is currently available for Fund Withdrawal and Event Approval applications only.
            </p>
            <Button variant="outline" asChild>
              <a href={`/admin/applications/${application.id}`}>Open standard review page</a>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownload} disabled={downloading || !pdfUrl}>
                {downloading ? "Downloading..." : "Download PDF"}
              </Button>
              <Button variant="outline" onClick={handlePrint} disabled={printing || !pdfUrl}>
                {printing ? "Preparing print..." : "Print PDF"}
              </Button>
            </div>

            {pdfUrl ? (
              <iframe
                title="Application PDF preview"
                src={pdfUrl}
                className="h-[78vh] w-full rounded-xl border border-border/70"
              />
            ) : (
              <p className="text-sm text-muted-foreground">PDF preview is unavailable.</p>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
