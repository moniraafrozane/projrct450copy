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
  resource_request: "Resource Request",
  budget_breakdown: "Budget Breakdown",
};

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
  const [users, setUsers] = useState<UserListItem[]>([]);
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

  useEffect(() => {
    applicationAPI
      .getApplications()
      .then((res) => setApplications(res.applications))
      .catch(() => setError("Failed to load applications for admin dashboard."))
      .finally(() => setLoading(false));

    userAPI
      .getUsers()
      .then((res) => setUsers(res.users ?? []))
      .catch(() => setUsersError("Failed to load users."))
      .finally(() => setUsersLoading(false));

    committeeAPI
      .getActiveCommittee()
      .then((res) => setActiveCommittee(res.committee ?? null))
      .catch(() => setActiveCommittee(null))
      .finally(() => setCommitteeLoading(false));
  }, []);

  const oversightApplications = useMemo(
    () =>
      applications.filter(
        (app) => app.type === "event_approval" || app.type === "resource_request"
      ),
    [applications]
  );

  const budgetApplications = useMemo(
    () => applications.filter((app) => app.type === "fund_withdrawal" || app.type === "budget_breakdown"),
    [applications]
  );

  const students = useMemo(
    () => users.filter((u) => u.roles.includes("student")),
    [users]
  );

  const societyMembers = useMemo(
    () => users.filter((u) => u.roles.includes("society")),
    [users]
  );

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
      setUsers((prev) =>
        prev.map((u) => (u.id === selectedUser.id ? { ...u, isActive: false } : u))
      );
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
              Student ID: {user.studentId || "N/A"} · Academic session: Year {user.year ?? "N/A"}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Society: {user.societyName || "N/A"} · Role: {user.societyRole || "N/A"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
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
    const pdfViewSupported = app.type === "fund_withdrawal" || app.type === "event_approval";

    return (
      <div key={app.id} className="rounded-2xl border border-border/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-base font-semibold text-foreground">
              {TYPE_LABELS[app.type] ?? app.type}
            </p>
            <p className="text-sm text-muted-foreground">{app.subject}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {app.createdByName} · {formatDate(app.createdAt)}
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
                href={pdfViewSupported ? `/admin/applications/${app.id}/pdf` : `/admin/applications/${app.id}`}
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
        title="Sign-in oversight & approvals"
        description="All event and resource request applications are reviewed here."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : oversightApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No event or resource request applications found.</p>
        ) : (
          <div className="space-y-4">{oversightApplications.map((app) => renderApplicationCard(app))}</div>
        )}
      </SectionCard>

      <SectionCard
        title="Budget governance"
        description="All budget applications are reviewed here."
      >
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading applications...</p>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : budgetApplications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No budget applications found.</p>
        ) : (
          <div className="space-y-4">{budgetApplications.map((app) => renderApplicationCard(app))}</div>
        )}
      </SectionCard>

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
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-foreground">Students</p>
                  {students.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No students found.</p>
                  ) : (
                    students.map((user) => renderUserRow(user, "student"))
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
                    societyMembers.map((user) => renderUserRow(user, "society"))
                  )}
                </div>
              )
            )}
          </div>
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
