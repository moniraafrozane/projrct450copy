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
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTargetUser, setRoleTargetUser] = useState<UserListItem | null>(null);
  const [selectedAssignRole, setSelectedAssignRole] = useState<"admin" | "society">("society");
  const [societyNameInput, setSocietyNameInput] = useState("");
  const [societyRoleInput, setSocietyRoleInput] = useState("");
  const [assigningRoleUserId, setAssigningRoleUserId] = useState<string | null>(null);

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

  const handleOpenAssignRole = (user: UserListItem) => {
    const missingAdminRole = !user.roles.includes("admin");
    setSelectedAssignRole(missingAdminRole ? "admin" : "society");
    setRoleTargetUser(user);
    setSocietyNameInput(user.societyName || "");
    setSocietyRoleInput(user.societyRole || "");
    setAccountError("");
    setRoleDialogOpen(true);
  };

  const handleAssignRole = async () => {
    if (!roleTargetUser) return;

    if (selectedAssignRole === "society" && !societyRoleInput.trim()) {
      setAccountError("Society position/role is required for society assignment.");
      setAccountMessage("");
      return;
    }

    setAssigningRoleUserId(roleTargetUser.id);
    setAccountMessage("");
    setAccountError("");

    try {
      const response = await userAPI.assignRole(roleTargetUser.id, {
        role: selectedAssignRole,
        societyName: selectedAssignRole === "society" ? societyNameInput.trim() || undefined : undefined,
        societyRole: selectedAssignRole === "society" ? societyRoleInput.trim() : undefined,
      });

      setUsers((prev) =>
        prev.map((user) =>
          user.id === roleTargetUser.id
            ? {
                ...user,
                roles: response.user?.roles || user.roles,
                societyName: response.user?.societyName ?? user.societyName,
                societyRole: response.user?.societyRole ?? user.societyRole,
              }
            : user
        )
      );

      const assignedLabel = selectedAssignRole === "admin" ? "admin" : "society member";
      setAccountMessage(`${roleTargetUser.name} is now assigned as ${assignedLabel}.`);
      setRoleDialogOpen(false);
      setRoleTargetUser(null);
      setSocietyNameInput("");
      setSocietyRoleInput("");
    } catch (error: unknown) {
      setAccountError(getApiErrorMessage(error, "Failed to assign role. Please try again."));
    } finally {
      setAssigningRoleUserId(null);
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
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant={user.isActive ? "success" : "warning"}>
            {user.isActive ? "Active" : "Closed"}
          </Badge>
          {kind === "student" && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => handleOpenAssignRole(user)}
              disabled={
                !user.isActive ||
                assigningRoleUserId === user.id ||
                (user.roles.includes("admin") && user.roles.includes("society"))
              }
            >
              {assigningRoleUserId === user.id
                ? "Assigning..."
                : user.roles.includes("admin") && user.roles.includes("society")
                ? "All roles assigned"
                : "Assign role"}
            </Button>
          )}
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

        <div className="mt-4 flex gap-2">
          <Button className="flex-1" size="sm" variant="outline" asChild>
            <a
              href={pdfViewSupported ? `/admin/applications/${app.id}/pdf` : `/admin/applications/${app.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View
            </a>
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-10">

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

      <Dialog
        open={roleDialogOpen}
        onOpenChange={(open) => {
          setRoleDialogOpen(open);
          if (!open) {
            setRoleTargetUser(null);
            setSocietyNameInput("");
            setSocietyRoleInput("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign role to student</DialogTitle>
            <DialogDescription>
              Choose whether this student should become a society member or a new admin.
            </DialogDescription>
          </DialogHeader>

          {roleTargetUser && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/70 p-3 text-sm">
                <p className="font-semibold text-foreground">{roleTargetUser.name}</p>
                <p className="text-muted-foreground">{roleTargetUser.email}</p>
                <p className="text-xs text-muted-foreground mt-1">Current roles: {roleTargetUser.roles.join(", ")}</p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Role to assign</p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={selectedAssignRole === "admin" ? "default" : "outline"}
                    onClick={() => setSelectedAssignRole("admin")}
                    disabled={roleTargetUser.roles.includes("admin")}
                  >
                    Make Admin
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedAssignRole === "society" ? "default" : "outline"}
                    onClick={() => setSelectedAssignRole("society")}
                    disabled={roleTargetUser.roles.includes("society")}
                  >
                    Make Society Member
                  </Button>
                </div>
              </div>

              {selectedAssignRole === "society" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex flex-col gap-2 text-sm">
                    Society name
                    <input
                      type="text"
                      value={societyNameInput}
                      onChange={(e) => setSocietyNameInput(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                      placeholder="e.g. CSE Society"
                    />
                  </label>
                  <label className="flex flex-col gap-2 text-sm">
                    Society position *
                    <input
                      type="text"
                      value={societyRoleInput}
                      onChange={(e) => setSocietyRoleInput(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                      placeholder="e.g. General Secretary"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRoleDialogOpen(false);
                setRoleTargetUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAssignRole}
              disabled={!roleTargetUser || assigningRoleUserId === roleTargetUser.id}
            >
              {assigningRoleUserId === roleTargetUser?.id ? "Assigning..." : "Confirm assignment"}
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
