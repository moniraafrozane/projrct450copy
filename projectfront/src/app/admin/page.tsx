"use client";

import { useEffect, useMemo, useState } from "react";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applicationAPI,
  committeeAPI,
  userAPI,
  type ApplicationStatus,
  type SocietyApplication,
  type UserListItem,
  type Committee,
} from "@/lib/api";

const STATUS_META: Record<
  ApplicationStatus,
  { label: string; variant: "default" | "accent" | "success" | "warning" | "destructive" }
> = {
  draft: { label: "Draft", variant: "default" },
  submitted: { label: "Submitted", variant: "accent" },
  under_review: { label: "Under review", variant: "accent" },
  approved: { label: "Approved", variant: "success" },
  returned: { label: "Returned", variant: "warning" },
};

const TYPE_LABELS: Record<string, string> = {
  fund_withdrawal: "Fund Withdrawal",
  event_approval: "Event Approval",
  resource_request: "Additional Budget",
  budget_breakdown: "Budget Breakdown",
};

function isStructuredBudgetBreakdown(app: SocietyApplication) {
  if (app.type !== "budget_breakdown") {
    return false;
  }

  const content = app.content;
  return Boolean(
    content &&
      typeof content === "object" &&
      Array.isArray((content as { sections?: unknown[] }).sections)
  );
}

function getSessionLabel(studentId: string | null | undefined): string {
  if (!studentId) return "Unknown";
  const year = parseInt(studentId.slice(0, 4), 10);
  if (isNaN(year) || year < 2000 || year > 2100) return "Unknown";
  return `${year}-${String(year + 1).slice(2)}`;
}

// Maps a student's admission batch year (from their registration number) to the
// academic semester they are currently in. Keep in sync with the backend mapping
// in projectbackend/controllers/studentAffairsController.js.
const BATCH_YEAR_TO_CURRENT_SEMESTER: Record<string, string> = {
  "2020": "8th",
  "2021": "7th",
  "2022": "6th",
  "2023": "4th",
  "2024": "3rd",
  "2025": "1st",
};

const SEMESTER_YEAR_TERM_LABEL: Record<string, string> = {
  "1st": "1/1",
  "2nd": "1/2",
  "3rd": "2/1",
  "4th": "2/2",
  "5th": "3/1",
  "6th": "3/2",
  "7th": "4/1",
  "8th": "4/2",
};

function getCurrentSemesterLabel(studentId: string | null | undefined): string {
  if (!studentId) return "N/A";
  const batchYear = studentId.slice(0, 4);
  const semester = BATCH_YEAR_TO_CURRENT_SEMESTER[batchYear];
  if (!semester) return "N/A";
  const yearTerm = SEMESTER_YEAR_TERM_LABEL[semester];
  return yearTerm ? `${semester}(${yearTerm})` : semester;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardPage() {
  const [applications, setApplications] = useState<SocietyApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [noteById, setNoteById] = useState<Record<string, string>>({});
  const [students, setStudents] = useState<UserListItem[]>([]);
  const [societyUsers, setSocietyUsers] = useState<UserListItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");
  const [activeCommittee, setActiveCommittee] = useState<Committee | null>(null);
  const [committeeLoading, setCommitteeLoading] = useState(true);
  const [closingUserId, setClosingUserId] = useState<string | null>(null);
  const [accountMessage, setAccountMessage] = useState("");
  const [accountError, setAccountError] = useState("");
  const [accountControlOpen, setAccountControlOpen] = useState(false);
  const [accountControlView, setAccountControlView] = useState<
    "committee" | "students" | "society"
  >("committee");
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
  const [closeReason, setCloseReason] = useState("");
  const [sessionFilter, setSessionFilter] = useState<string>("");
  const [studentsPage, setStudentsPage] = useState(1);
  const [societyPage, setSocietyPage] = useState(1);

  const STUDENTS_PAGE_SIZE = 10;
  const SOCIETY_PAGE_SIZE = 10;

  useEffect(() => {
    applicationAPI
      .getApplications()
      .then((res) => setApplications(res.applications))
      .catch(() => setError("Failed to load applications for admin dashboard."))
      .finally(() => setLoading(false));

    Promise.all([
      userAPI.getStudents(),
      userAPI.getUsers(),
    ])
      .then(([studentsRes, usersRes]) => {
        setStudents(studentsRes.users ?? []);
        setSocietyUsers((usersRes.users ?? []).filter((u) => u.roles.includes("society")));
      })
      .catch(() => setUsersError("Failed to load users."))
      .finally(() => setUsersLoading(false));

    committeeAPI
      .getActiveCommittee()
      .then((res) => setActiveCommittee(res.committee ?? null))
      .catch(() => setActiveCommittee(null))
      .finally(() => setCommitteeLoading(false));
  }, []);

  const eventApprovalApplications = useMemo(
    () => applications.filter((app) => app.type === "event_approval"),
    [applications]
  );
  const fundWithdrawalApplications = useMemo(
    () => applications.filter((app) => app.type === "fund_withdrawal"),
    [applications]
  );

  const additionalBudgetApplications = useMemo(
    () =>
      applications.filter(
        (app) => app.type === "resource_request" || (app.type === "budget_breakdown" && !isStructuredBudgetBreakdown(app))
      ),
    [applications]
  );

  const budgetBreakdownApplications = useMemo(
    () =>
      applications.filter(
        (app) =>
          isStructuredBudgetBreakdown(app) &&
          ["under_review", "submitted", "approved", "returned"].includes(app.status)
      ),
    [applications]
  );

  const societyMembers = societyUsers;

  const activeCommitteeMemberIds = useMemo(
    () => new Set((activeCommittee?.members ?? []).map((m) => m.user.id)),
    [activeCommittee]
  );

  const societyMembersOrdered = useMemo(() => {
    const present = societyMembers.filter((u) => activeCommitteeMemberIds.has(u.id));
    const past = societyMembers.filter((u) => !activeCommitteeMemberIds.has(u.id));
    return [...present, ...past];
  }, [societyMembers, activeCommitteeMemberIds]);

  const studentsBySession = useMemo(() => {
    const groups: Record<string, typeof students> = {};
    for (const student of students) {
      const session = getSessionLabel(student.studentId);
      if (!groups[session]) groups[session] = [];
      groups[session].push(student);
    }
    return groups;
  }, [students]);

  const sessionKeys = useMemo(
    () => Object.keys(studentsBySession).sort((a, b) => b.localeCompare(a)),
    [studentsBySession]
  );

  const filteredSessionKeys = useMemo(
    () => (sessionFilter ? sessionKeys.filter((s) => s === sessionFilter) : sessionKeys),
    [sessionKeys, sessionFilter]
  );

  const allFilteredStudents = useMemo(
    () => filteredSessionKeys.flatMap((session) => studentsBySession[session] ?? []),
    [filteredSessionKeys, studentsBySession]
  );

  const studentsPageCount = Math.max(1, Math.ceil(allFilteredStudents.length / STUDENTS_PAGE_SIZE));

  const paginatedStudents = useMemo(
    () => allFilteredStudents.slice((studentsPage - 1) * STUDENTS_PAGE_SIZE, studentsPage * STUDENTS_PAGE_SIZE),
    [allFilteredStudents, studentsPage]
  );

  const paginatedStudentsBySession = useMemo(() => {
    const groups: Record<string, typeof students> = {};
    for (const student of paginatedStudents) {
      const session = getSessionLabel(student.studentId);
      if (!groups[session]) groups[session] = [];
      groups[session].push(student);
    }
    return groups;
  }, [paginatedStudents]);

  const paginatedSessionKeys = useMemo(
    () => Object.keys(paginatedStudentsBySession).sort((a, b) => b.localeCompare(a)),
    [paginatedStudentsBySession]
  );

  const societyPageCount = Math.max(1, Math.ceil(societyMembersOrdered.length / SOCIETY_PAGE_SIZE));

  const paginatedSocietyMembers = useMemo(
    () => societyMembersOrdered.slice((societyPage - 1) * SOCIETY_PAGE_SIZE, societyPage * SOCIETY_PAGE_SIZE),
    [societyMembersOrdered, societyPage]
  );

  const paginatedPresentSocietyMembers = useMemo(
    () => paginatedSocietyMembers.filter((u) => activeCommitteeMemberIds.has(u.id)),
    [paginatedSocietyMembers, activeCommitteeMemberIds]
  );

  const paginatedPastSocietyMembers = useMemo(
    () => paginatedSocietyMembers.filter((u) => !activeCommitteeMemberIds.has(u.id)),
    [paginatedSocietyMembers, activeCommitteeMemberIds]
  );

  useEffect(() => { setStudentsPage(1); }, [sessionFilter, accountControlView]);
  useEffect(() => { setSocietyPage(1); }, [accountControlView]);

  const syncApplication = (updated: SocietyApplication) => {
    setApplications((prev) => prev.map((app) => (app.id === updated.id ? updated : app)));
  };

  const handleApprove = async (id: string) => {
    setLoadingActionId(id);
    setActionMessage("");
    setActionError("");

    try {
      const res = await applicationAPI.approveApplication(id);
      syncApplication(res.application);
      setActionMessage("Application approved successfully.");
    } catch (error: any) {
      setActionError(
        error?.response?.data?.message || "Failed to approve application. Please try again."
      );
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleReturn = async (id: string) => {
    const note = (noteById[id] ?? "").trim();
    if (!note) {
      setActionError("Admin note is required to return an application.");
      setActionMessage("");
      return;
    }

    setLoadingActionId(id);
    setActionMessage("");
    setActionError("");

    try {
      const res = await applicationAPI.returnApplication(id, note);
      syncApplication(res.application);
      setActionMessage("Application returned to society member.");
      setNoteById((prev) => ({ ...prev, [id]: "" }));
    } catch (error: any) {
      setActionError(
        error?.response?.data?.message || "Failed to return application. Please try again."
      );
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleCloseAccount = async () => {
    if (!selectedUser) return;

    const reason = closeReason.trim();
    if (!reason) {
      setAccountError("Please add a reason before closing the account.");
      setAccountMessage("");
      return;
    }

    setClosingUserId(selectedUser.id);
    setAccountMessage("");
    setAccountError("");

    try {
      await userAPI.closeUser(selectedUser.id, reason);
      setStudents((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setSocietyUsers((prev) => prev.filter((u) => u.id !== selectedUser.id));
      setAccountMessage("Account closed successfully.");
      setCloseDialogOpen(false);
      setSelectedUser(null);
      setCloseReason("");
    } catch {
      setAccountError("Failed to close account. Please try again.");
    } finally {
      setClosingUserId(null);
    }
  };

  const renderUserRow = (user: UserListItem, kind: "student" | "society") => (
    <div key={user.id} className="rounded-2xl border border-border/70 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{user.name}</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
          {kind === "student" ? (
            <p className="text-xs text-muted-foreground mt-1">
              Student ID: {user.studentId || "N/A"} · Academic session: Year {user.year ?? "N/A"} · Semester: {getCurrentSemesterLabel(user.studentId)}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Society: {
                activeCommitteeMemberIds.has(user.id) && activeCommittee
                  ? `${formatShortDate(activeCommittee.termStart)} — ${formatShortDate(activeCommittee.termEnd)}`
                  : (user.societyName || "N/A")
              } · Role: {user.societyRole || "N/A"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant={user.isActive ? "success" : "warning"}>
            {user.isActive ? "Active" : "Closed"}
          </Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedUser(user);
              setCloseReason("");
              setAccountError("");
              setCloseDialogOpen(true);
            }}
            disabled={!user.isActive || closingUserId === user.id}
          >
            {closingUserId === user.id ? "Closing..." : "Close account"}
          </Button>
        </div>
      </div>
    </div>
  );

  const renderApplicationCard = (app: SocietyApplication) => {
    const status = STATUS_META[app.status] ?? STATUS_META.submitted;
    const canReview = app.status === "submitted" || app.status === "under_review";
    const isBudgetBreakdown = isStructuredBudgetBreakdown(app);
    const viewHref = isBudgetBreakdown
      ? `/admin/applications/${app.id}`
      : `/admin/applications/${app.id}/pdf`;

    return (
      <div key={app.id} className="rounded-2xl border border-border/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">
              {TYPE_LABELS[app.type] ?? app.type}
            </p>
            <p className="text-sm text-muted-foreground">{app.subject}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {app.createdByName} · {formatDate(app.forwardedAt || app.createdAt)}
            </p>
          </div>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>

        {app.adminNotes && (
          <div className="mt-4 rounded-xl border border-amber-300/60 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Admin note</p>
            <p className="mt-1 whitespace-pre-wrap">{app.adminNotes}</p>
          </div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <textarea
            className="w-full rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm"
            placeholder="Add note before returning application"
            value={noteById[app.id] ?? ""}
            onChange={(e) => setNoteById((prev) => ({ ...prev, [app.id]: e.target.value }))}
            disabled={!canReview || loadingActionId === app.id}
          />
          <div className="flex gap-2">
            <Button className="flex-1" size="sm" variant="outline" asChild>
              <a
                href={viewHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                View
              </a>
            </Button>
            <Button
              className="flex-1"
              size="sm"
              onClick={() => handleApprove(app.id)}
              disabled={!canReview || loadingActionId === app.id}
            >
              {loadingActionId === app.id ? "Processing..." : "Approve"}
            </Button>
            <Button
              className="flex-1"
              size="sm"
              variant="outline"
              onClick={() => handleReturn(app.id)}
              disabled={!canReview || loadingActionId === app.id}
            >
              {loadingActionId === app.id ? "Processing..." : "Reject / Return"}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">
      {actionMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {actionMessage}
        </div>
      )}

      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <SectionCard
        title="Session expiry account control"
        description="Review students and society members with session context and close expired accounts manually."
      >
        <Button
          variant="outline"
          onClick={() => setAccountControlOpen((prev) => !prev)}
          className="mb-4"
        >
          {accountControlOpen ? "Hide session expiry account control" : "Session expiry account control"}
        </Button>

        {accountControlOpen && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={accountControlView === "committee" ? "secondary" : "outline"}
                onClick={() => setAccountControlView("committee")}
              >
                Active committee session
              </Button>
              <Button
                size="sm"
                variant={accountControlView === "students" ? "secondary" : "outline"}
                onClick={() => setAccountControlView("students")}
              >
                Students
              </Button>
              <Button
                size="sm"
                variant={accountControlView === "society" ? "secondary" : "outline"}
                onClick={() => setAccountControlView("society")}
              >
                Society members
              </Button>
            </div>

            {accountMessage && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {accountMessage}
              </div>
            )}

            {accountError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {accountError}
              </div>
            )}

            {accountControlView === "committee" && (
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-sm font-semibold text-foreground">Active committee session</p>
                {committeeLoading ? (
                  <p className="mt-1 text-xs text-muted-foreground">Loading committee session...</p>
                ) : activeCommittee ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {activeCommittee.name} · {formatDate(activeCommittee.termStart)} to {formatDate(activeCommittee.termEnd)}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-muted-foreground">No active committee session found.</p>
                )}
              </div>
            )}

            {accountControlView === "students" && (
              usersLoading ? (
                <p className="text-sm text-muted-foreground">Loading users...</p>
              ) : usersError ? (
                <p className="text-sm text-destructive">{usersError}</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Filter by session:</span>
                    <button
                      onClick={() => setSessionFilter("")}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                        sessionFilter === ""
                          ? "bg-foreground text-background border-foreground"
                          : "border-border/70 text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      All
                    </button>
                    {sessionKeys.map((s) => (
                      <button
                        key={s}
                        onClick={() => setSessionFilter(s)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          sessionFilter === s
                            ? "bg-foreground text-background border-foreground"
                            : "border-border/70 text-muted-foreground hover:border-foreground hover:text-foreground"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  {students.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No students found.</p>
                  ) : allFilteredStudents.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No students match the selected session.</p>
                  ) : (
                    <>
                      <div className="space-y-6">
                        {paginatedSessionKeys.map((session) => (
                          <div key={session}>
                            <div className="mb-3 flex items-center gap-3">
                              <p className="text-sm font-semibold text-foreground">Session {session}</p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {studentsBySession[session].length} students
                              </span>
                            </div>
                            <div className="space-y-3">
                              {paginatedStudentsBySession[session].map((user) => renderUserRow(user, "student"))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStudentsPage((p) => p - 1)}
                          disabled={studentsPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Page {studentsPage} of {studentsPageCount} · {allFilteredStudents.length} students total
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStudentsPage((p) => p + 1)}
                          disabled={studentsPage === studentsPageCount}
                        >
                          Next
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            )}

            {accountControlView === "society" && (
              usersLoading ? (
                <p className="text-sm text-muted-foreground">Loading users...</p>
              ) : usersError ? (
                <p className="text-sm text-destructive">{usersError}</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Society members</p>
                  {societyMembers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No society members found.</p>
                  ) : (
                    <>
                      <div className="space-y-6">
                        {paginatedPresentSocietyMembers.length > 0 && (
                          <div>
                            <div className="mb-3 flex items-center gap-3">
                              <p className="text-sm font-semibold text-foreground">Present committee members</p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {paginatedPresentSocietyMembers.length} members
                              </span>
                            </div>
                            <div className="space-y-3">
                              {paginatedPresentSocietyMembers.map((user) => renderUserRow(user, "society"))}
                            </div>
                          </div>
                        )}
                        {paginatedPastSocietyMembers.length > 0 && (
                          <div>
                            <div className="mb-3 flex items-center gap-3">
                              <p className="text-sm font-semibold text-foreground">Past committee members</p>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                                {paginatedPastSocietyMembers.length} members
                              </span>
                            </div>
                            <div className="space-y-3">
                              {paginatedPastSocietyMembers.map((user) => renderUserRow(user, "society"))}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSocietyPage((p) => p - 1)}
                          disabled={societyPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          Page {societyPage} of {societyPageCount} · {societyMembersOrdered.length} members total
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSocietyPage((p) => p + 1)}
                          disabled={societyPage === societyPageCount}
                        >
                          Next
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </SectionCard>

      <SectionCard
        title="Event Approval"
        description="Review and approve event applications submitted by societies."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : eventApprovalApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No event approval applications found.</p>
        ) : (
          <div className="space-y-4">{eventApprovalApplications.map((app) => renderApplicationCard(app))}</div>
        )}
      </SectionCard>

      <SectionCard
        title="Fund Withdrawal"
        description="Review and approve fund withdrawal requests from societies."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : fundWithdrawalApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No fund withdrawal applications found.</p>
        ) : (
          <div className="space-y-4">{fundWithdrawalApplications.map((app) => renderApplicationCard(app))}</div>
        )}
      </SectionCard>

      <SectionCard
        title="Additional Budget"
        description="Review additional budget requests from societies."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : additionalBudgetApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No additional budget applications found.</p>
        ) : (
          <div className="space-y-4">{additionalBudgetApplications.map((app) => renderApplicationCard(app))}</div>
        )}
      </SectionCard>

      <SectionCard
        title="Budget Breakdown"
        description="Review budget breakdowns submitted by society members."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : budgetBreakdownApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budget breakdown applications found.</p>
        ) : (
          <div className="space-y-4">{budgetBreakdownApplications.map((app) => renderApplicationCard(app))}</div>
        )}
      </SectionCard>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Close account confirmation</DialogTitle>
            <DialogDescription>
              Confirm closing the selected user account. Add a reason for this action.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/70 p-3 text-sm">
                <p className="font-semibold text-foreground">{selectedUser.name}</p>
                <p className="text-muted-foreground">{selectedUser.email}</p>
              </div>
              <textarea
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                rows={4}
                placeholder="Reason for closing this account"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCloseDialogOpen(false);
                setSelectedUser(null);
                setCloseReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleCloseAccount}
              disabled={!selectedUser || !!closingUserId}
            >
              {closingUserId ? "Closing..." : "Confirm close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object" &&
    (error as { response?: unknown }).response !== null
  ) {
    const response = (error as { response?: { data?: { message?: unknown } } }).response;
    const message = response?.data?.message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}
