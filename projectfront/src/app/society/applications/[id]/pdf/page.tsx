"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { applicationAPI, type SocietyApplication } from "@/lib/api";

function getIdFromParams(idParam: string | string[] | undefined): string | null {
  if (Array.isArray(idParam)) return idParam[0] ?? null;
  return idParam ?? null;
}

export default function SocietyApplicationPdfPage() {
  const params = useParams();
  const id = getIdFromParams(params?.id as string | string[] | undefined);

  const [application, setApplication] = useState<SocietyApplication | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");

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
    if (!id) return;

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
    if (!id) return;

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
        eyebrow="Society"
        title="Application PDF"
        description="View the submitted application in PDF form and keep a copy for your records."
        actions={[{ label: "Back to applications", href: "/society/applications", variant: "outline" }]}
      />

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <SectionCard
        title="Application document"
        description="This PDF mirrors the original letter-style application submitted by the society member."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading PDF...</p>
        ) : !application ? (
          <p className="text-sm text-muted-foreground">Application not found.</p>
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