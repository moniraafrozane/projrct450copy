"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  studentAffairsAPI,
  type StudentFeeReportStudentRow,
  type StudentFeeSemesterCell,
  type StudentFeeSemesterCode,
} from "@/lib/api";

const SEMESTERS: Array<{
  code: StudentFeeSemesterCode;
  label: StudentFeeSemesterCell["label"];
  title: string;
}> = [
  { code: "1st", label: "1/1", title: "1st Year 1st Semester" },
  { code: "2nd", label: "1/2", title: "1st Year 2nd Semester" },
  { code: "3rd", label: "2/1", title: "2nd Year 1st Semester" },
  { code: "4th", label: "2/2", title: "2nd Year 2nd Semester" },
  { code: "5th", label: "3/1", title: "3rd Year 1st Semester" },
  { code: "6th", label: "3/2", title: "3rd Year 2nd Semester" },
  { code: "7th", label: "4/1", title: "4th Year 1st Semester" },
  { code: "8th", label: "4/2", title: "4th Year 2nd Semester" },
];

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function cellClassName(status: StudentFeeSemesterCell["status"]) {
  if (status === "paid") {
    return "border-emerald-300 bg-emerald-100 text-emerald-950";
  }

  return "border-rose-300 bg-rose-50 text-rose-950";
}

export function StudentFeeReportTable() {
  const [students, setStudents] = useState<StudentFeeReportStudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [session, setSession] = useState("");
  const [semester, setSemester] = useState("");
  const [registration, setRegistration] = useState("");
  const [totalPaidStudents, setTotalPaidStudents] = useState(0);
  const [totalResults, setTotalResults] = useState(0);
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalPaidSemesters, setTotalPaidSemesters] = useState(0);
  const [totalUnpaidSemesters, setTotalUnpaidSemesters] = useState(0);
  const reportLimit = 1000;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await studentAffairsAPI.getReceiptsReport({
        search: search.trim() || undefined,
        session: session.trim() || undefined,
        semester: semester.trim() || undefined,
        registration: registration.trim() || undefined,
        page: 1,
        limit: reportLimit,
      });

      setStudents(res.students ?? []);
      setTotalPaidStudents(res.totals?.totalPaidStudents ?? 0);
      setTotalResults(res.totals?.totalResults ?? 0);
      setTotalStudents(res.totals?.totalStudents ?? res.students?.length ?? 0);
      setTotalPaidSemesters(res.totals?.totalPaidSemesters ?? 0);
      setTotalUnpaidSemesters(res.totals?.totalUnpaidSemesters ?? 0);
    } catch {
      setError("Failed to load report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasFilters = useMemo(() => {
    return Boolean(search.trim() || session.trim() || semester.trim() || registration.trim());
  }, [registration, search, semester, session]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="flex flex-col gap-2 text-sm text-muted-foreground md:col-span-4">
          Search
          <input
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
            placeholder="Search by name, email, registration number, reference, session, or semester"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Session
          <input
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
            placeholder="e.g. 2024-25"
            value={session}
            onChange={(e) => setSession(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Registration Number
          <input
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
            placeholder="e.g. 2024331063 or 24 for 2024 batch"
            value={registration}
            onChange={(e) => setRegistration(e.target.value)}
          />
        </label>

        <label className="flex flex-col gap-2 text-sm text-muted-foreground">
          Semester
          <input
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground"
            placeholder="e.g. 1st, 1/1, 2nd, 2/2"
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
          />
        </label>

        <div className="flex items-end gap-2">
          <Button onClick={loadReport}>Apply</Button>
          <Button
            variant="outline"
            onClick={() => {
              setSearch("");
              setSession("");
              setRegistration("");
              setSemester("");
              loadReport();
            }}
            disabled={!hasFilters}
          >
            Reset
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
          Students: <span className="font-semibold">{totalStudents}</span>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
          Paid semesters: <span className="font-semibold">{totalPaidSemesters}</span>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
          Unpaid semesters: <span className="font-semibold">{totalUnpaidSemesters}</span>
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
          Matched payments: <span className="font-semibold">{totalResults}</span>
          <span className="ml-3 text-muted-foreground">Students with payments: {totalPaidStudents}</span>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-background px-4 py-3 text-sm text-muted-foreground">
        Green cells are paid. Red cells are unpaid.
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading report...</p>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-muted-foreground">No student records found for the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/70">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40 text-left">
              <tr>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Registration</th>
                <th className="px-4 py-3">Current Semester</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Unpaid</th>
                {SEMESTERS.map((semesterColumn) => (
                  <th key={semesterColumn.code} className="px-4 py-3">
                    <div className="flex flex-col">
                      <span>{semesterColumn.label}</span>
                      <span className="text-xs font-normal text-muted-foreground">{semesterColumn.title}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((row) => (
                <tr key={row.student.id} className="border-t border-border/70 align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{row.student.name}</p>
                    <p className="text-xs text-muted-foreground">{row.student.email}</p>
                  </td>
                  <td className="px-4 py-3">{row.student.studentId || "-"}</td>
                  <td className="px-4 py-3">
                    {row.currentSemester ? (
                      <div>
                        <p className="font-medium">{row.currentSemester.label}</p>
                        <p className="text-xs text-muted-foreground">{row.currentSemester.session}</p>
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-700">{row.totals.paidSemesters}</td>
                  <td className="px-4 py-3 font-semibold text-rose-700">{row.totals.unpaidSemesters}</td>
                  {row.semesters.map((cell) => {
                    const isPaid = cell.status === "paid";

                    return (
                      <td key={`${row.student.id}-${cell.code}`} className="px-2 py-3">
                        <div className={`min-h-36 rounded-2xl border p-3 ${cellClassName(cell.status)}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold">{cell.label}</p>
                              <p className="text-xs opacity-80">{cell.title}</p>
                            </div>
                            <Badge variant={isPaid ? "success" : "warning"}>{isPaid ? "Paid" : "Unpaid"}</Badge>
                          </div>

                          {isPaid ? (
                            <div className="mt-3 space-y-1 text-xs">
                              <p className="font-medium">৳{(cell.amount ?? 0).toFixed(2)}</p>
                              <p>Payment date: {formatDate(cell.paymentDate)}</p>
                              {cell.reference && <p className="break-all">Ref: {cell.reference}</p>}
                            </div>
                          ) : (
                            <div className="mt-3 space-y-2 text-xs">
                              <p>Fee not recorded yet.</p>
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
