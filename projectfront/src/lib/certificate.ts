import jsPDF from "jspdf";

interface CertificateData {
  studentName: string;
  eventTitle: string;
  eventDate: string;
  eventVenue: string;
  organizerName: string;
  registrationDate: string;
}

export function generateEventCertificate(data: CertificateData): void {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const W = 297;
  const H = 210;

  // ── Background ──────────────────────────────────────────────────────
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, W, H, "F");

  // Outer border (navy)
  doc.setDrawColor(15, 40, 90);
  doc.setLineWidth(3);
  doc.rect(8, 8, W - 16, H - 16, "S");

  // Inner border (gold)
  doc.setDrawColor(180, 140, 50);
  doc.setLineWidth(1);
  doc.rect(12, 12, W - 24, H - 24, "S");

  // Top accent bar
  doc.setFillColor(15, 40, 90);
  doc.rect(8, 8, W - 16, 18, "F");

  // Bottom accent bar
  doc.setFillColor(15, 40, 90);
  doc.rect(8, H - 26, W - 16, 18, "F");

  // ── Header text in top bar ───────────────────────────────────────────
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CERTIFICATE OF PARTICIPATION", W / 2, 20, { align: "center" });

  // ── Organisation name ────────────────────────────────────────────────
  doc.setTextColor(15, 40, 90);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(data.organizerName.toUpperCase(), W / 2, 40, { align: "center" });

  // Thin gold rule
  doc.setDrawColor(180, 140, 50);
  doc.setLineWidth(0.6);
  doc.line(40, 44, W - 40, 44);

  // ── "This is to certify that" ────────────────────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("This is to certify that", W / 2, 58, { align: "center" });

  // ── Student name ─────────────────────────────────────────────────────
  doc.setTextColor(15, 40, 90);
  doc.setFontSize(26);
  doc.setFont("helvetica", "bolditalic");
  doc.text(data.studentName, W / 2, 76, { align: "center" });

  // Underline for student name
  const nameWidth = doc.getTextWidth(data.studentName);
  doc.setDrawColor(180, 140, 50);
  doc.setLineWidth(0.8);
  doc.line(W / 2 - nameWidth / 2, 79, W / 2 + nameWidth / 2, 79);

  // ── Body text ────────────────────────────────────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("has successfully participated in", W / 2, 92, { align: "center" });

  // ── Event title ──────────────────────────────────────────────────────
  doc.setTextColor(15, 40, 90);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(`"${data.eventTitle}"`, W / 2, 106, { align: "center" });

  // ── Event details ────────────────────────────────────────────────────
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const eventDateFormatted = new Date(data.eventDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(`held on ${eventDateFormatted} at ${data.eventVenue}`, W / 2, 118, {
    align: "center",
  });

  // ── Thin rule before signatures ──────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.4);
  doc.line(40, 130, W - 40, 130);

  // ── Signature area ───────────────────────────────────────────────────
  const sigY = 152;
  const sigLineLen = 55;

  // Left signature
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  const leftX = 60;
  doc.line(leftX, sigY, leftX + sigLineLen, sigY);
  doc.setTextColor(80, 80, 80);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Organiser", leftX + sigLineLen / 2, sigY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(data.organizerName, leftX + sigLineLen / 2, sigY + 10, { align: "center" });

  // Right signature
  const rightX = W - 60 - sigLineLen;
  doc.line(rightX, sigY, rightX + sigLineLen, sigY);
  doc.setFont("helvetica", "bold");
  doc.text("Issued On", rightX + sigLineLen / 2, sigY + 5, { align: "center" });
  doc.setFont("helvetica", "normal");
  const issuedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.text(issuedDate, rightX + sigLineLen / 2, sigY + 10, { align: "center" });

  // ── Footer bar text ──────────────────────────────────────────────────
  doc.setTextColor(200, 200, 200);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(
    "This certificate is issued as a recognition of participation and achievement.",
    W / 2,
    H - 14,
    { align: "center" }
  );

  // ── Download ─────────────────────────────────────────────────────────
  const safeName = data.studentName.replace(/\s+/g, "_");
  const safeEvent = data.eventTitle.replace(/\s+/g, "_");
  doc.save(`Certificate_${safeName}_${safeEvent}.pdf`);
}
