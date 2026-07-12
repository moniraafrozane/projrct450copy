"use client";

import { useState, useEffect, useCallback } from "react";
import { SectionCard } from "@/components/patterns/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  committeeAPI,
  userAPI,
  type Committee,
  type CommitteeMember,
  type CommitteeRole,
  type UserListItem,
} from "@/lib/api";

// ─── Constants ──────────────────────────────────────────────────────

const COMMITTEE_ROLES: { value: CommitteeRole; label: string }[] = [
  { value: "VICE_PRESIDENT", label: "Vice President" },
  { value: "GENERAL_SECRETARY", label: "General Secretary" },
  { value: "EVENT_CULTURAL_SECRETARY", label: "Event & Cultural Secretary" },
  { value: "SPORTS_SECRETARY", label: "Sports Secretary" },
  { value: "PUBLICATION_SECRETARY", label: "Publication Secretary" },
  { value: "ASSISTANT_EVENT_CULTURAL_SECRETARY", label: "Asst. Event & Cultural Secretary" },
  { value: "EXECUTIVE_MEMBER", label: "Executive Member" },
];

const ROLE_LABEL_MAP: Record<CommitteeRole, string> = Object.fromEntries(
  COMMITTEE_ROLES.map((r) => [r.value, r.label])
) as Record<CommitteeRole, string>;

// Role display order (lower = higher rank)
const ROLE_ORDER: Record<CommitteeRole, number> = {
  VICE_PRESIDENT: 0,
  GENERAL_SECRETARY: 1,
  EVENT_CULTURAL_SECRETARY: 2,
  SPORTS_SECRETARY: 3,
  PUBLICATION_SECRETARY: 4,
  ASSISTANT_EVENT_CULTURAL_SECRETARY: 5,
  EXECUTIVE_MEMBER: 6,
};

const ROLE_BADGE_VARIANT: Record<string, "default" | "accent" | "success" | "warning" | "destructive" | "outline"> = {
  VICE_PRESIDENT: "destructive",
  GENERAL_SECRETARY: "accent",
  EVENT_CULTURAL_SECRETARY: "default",
  SPORTS_SECRETARY: "success",
  PUBLICATION_SECRETARY: "warning",
  ASSISTANT_EVENT_CULTURAL_SECRETARY: "outline",
  EXECUTIVE_MEMBER: "outline",
};

type UserItem = UserListItem;

// ─── Page Component ─────────────────────────────────────────────────

export default function CommitteePage() {
  // ── State ──────────────────────────────────────────────────────
  const [activeCommittee, setActiveCommittee] = useState<Committee | null>(null);
  const [pastCommittees, setPastCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create committee form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTermStart, setNewTermStart] = useState("");
  const [newTermEnd, setNewTermEnd] = useState("");
  const [creating, setCreating] = useState(false);

  // Add member dialog
  const [showAddMember, setShowAddMember] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<CommitteeRole | "">("");
  const [addingMember, setAddingMember] = useState(false);
  const [addMemberError, setAddMemberError] = useState("");

  // Expanded past committee
  const [expandedPast, setExpandedPast] = useState<string | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────

  const fetchCommittees = useCallback(async () => {
    try {
      setLoading(true);
      const res = await committeeAPI.getCommittees();
      if (res.success && res.committees) {
        const active = res.committees.find((c) => c.isActive) || null;
        const past = res.committees.filter((c) => !c.isActive);
        setActiveCommittee(active);
        setPastCommittees(past);
      }
    } catch {
      setError("Failed to load committees");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      setUsersLoading(true);
      const res = await userAPI.getUsers();
      if (res.success && res.users) {
        setUsers(res.users);
      }
    } catch {
      // silent
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommittees();
  }, [fetchCommittees]);

  // ── Handlers ───────────────────────────────────────────────────

  const handleCreateCommittee = async () => {
    if (!newName.trim() || !newTermStart || !newTermEnd) return;
    setCreating(true);
    setError("");
    try {
      const res = await committeeAPI.createCommittee({
        name: newName.trim(),
        termStart: newTermStart,
        termEnd: newTermEnd,
      });
      if (res.success) {
        setShowCreateForm(false);
        setNewName("");
        setNewTermStart("");
        setNewTermEnd("");
        await fetchCommittees();
      } else {
        setError(res.message || "Failed to create committee");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to create committee");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenAddMember = () => {
    setShowAddMember(true);
    setSelectedUserId(null);
    setSelectedRole("");
    setAddMemberError("");
    setUserSearch("");
    fetchUsers();
  };

  const handleAddMember = async () => {
    if (!activeCommittee || !selectedUserId || !selectedRole) return;
    setAddingMember(true);
    setAddMemberError("");
    try {
      const res = await committeeAPI.addMember(activeCommittee.id, {
        userId: selectedUserId,
        role: selectedRole as CommitteeRole,
      });
      if (res.success) {
        setShowAddMember(false);
        await fetchCommittees();
      } else {
        setAddMemberError(res.message || "Failed to add member");
      }
    } catch (err: any) {
      setAddMemberError(err.response?.data?.message || "Failed to add member");
    } finally {
      setAddingMember(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!activeCommittee) return;
    try {
      await committeeAPI.removeMember(activeCommittee.id, memberId);
      await fetchCommittees();
    } catch {
      // silent
    }
  };

  const handleDeactivate = async () => {
    if (!activeCommittee) return;
    try {
      await committeeAPI.deactivateCommittee(activeCommittee.id);
      await fetchCommittees();
    } catch {
      // silent
    }
  };

  // ── Derived data ───────────────────────────────────────────────

  const sortedMembers = (members: CommitteeMember[]) =>
    [...members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.studentId && u.studentId.toLowerCase().includes(q))
    );
  });

  // check which singleton roles are already taken
  const takenSingletonRoles = new Set(
    (activeCommittee?.members || [])
      .filter((m) => m.role !== "EXECUTIVE_MEMBER")
      .map((m) => m.role)
  );

  // available roles for the dropdown
  const availableRoles = COMMITTEE_ROLES.filter((r) => {
    if (r.value === "EXECUTIVE_MEMBER") return true;
    return !takenSingletonRoles.has(r.value);
  });

  // ── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-muted-foreground">Loading committees...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Error Banner ─────────────────────────────────────── */}
      {error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Active Committee ─────────────────────────────────── */}
      {activeCommittee ? (
        <SectionCard
          title={activeCommittee.name}
          description={`${fmt(activeCommittee.termStart)} — ${fmt(activeCommittee.termEnd)}  ·  ${activeCommittee.members.length} member${activeCommittee.members.length !== 1 ? "s" : ""}`}
          actions={
            <div className="flex gap-2">
              <Button size="sm" onClick={handleOpenAddMember}>
                + Add Member
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDeactivate}
              >
                End Term
              </Button>
            </div>
          }
        >
          {activeCommittee.members.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No members yet. Click <strong>+ Add Member</strong> to start
              building the committee.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sortedMembers(activeCommittee.members).map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  onRemove={() => handleRemoveMember(m.id)}
                  editable
                />
              ))}
            </div>
          )}
        </SectionCard>
      ) : (
        /* ── No Active Committee → Create Form ─────────────── */
        <SectionCard
          title="Committee"
          description="No active committee. Create one to get started."
        >
          {!showCreateForm ? (
            <div className="flex justify-center py-8">
              <Button onClick={() => setShowCreateForm(true)}>
                Create New Committee
              </Button>
            </div>
          ) : (
            <div className="mx-auto max-w-md space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="committeeName">Committee Name</Label>
                <Input
                  id="committeeName"
                  placeholder='e.g. "Spring 2026"'
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="termStart">Term Start</Label>
                  <Input
                    id="termStart"
                    type="date"
                    value={newTermStart}
                    onChange={(e) => setNewTermStart(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="termEnd">Term End</Label>
                  <Input
                    id="termEnd"
                    type="date"
                    value={newTermEnd}
                    onChange={(e) => setNewTermEnd(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateForm(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateCommittee}
                  disabled={creating || !newName.trim() || !newTermStart || !newTermEnd}
                >
                  {creating ? "Creating..." : "Create Committee"}
                </Button>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* ── Add Member Dialog ────────────────────────────────── */}
      <Dialog open={showAddMember} onOpenChange={setShowAddMember}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Add Committee Member</DialogTitle>
            <DialogDescription>
              Search for a user, pick a role, and assign them.
            </DialogDescription>
          </DialogHeader>

          {/* Role selector */}
          <div className="space-y-2">
            <Label>Role</Label>
            <div className="flex flex-wrap gap-2">
              {availableRoles.map((r) => (
                <Button
                  key={r.value}
                  size="sm"
                  variant={selectedRole === r.value ? "default" : "outline"}
                  onClick={() => setSelectedRole(r.value)}
                  className="text-xs"
                >
                  {r.label}
                </Button>
              ))}
            </div>
          </div>

          {/* User search */}
          <div className="space-y-2">
            <Label>Search User</Label>
            <Input
              placeholder="Type name, email or student ID..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>

          {/* User list */}
          <div className="flex-1 min-h-0 overflow-y-auto border rounded-xl divide-y max-h-64">
            {usersLoading ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No users match your search.
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = selectedUserId === u.id;
                const alreadyInCommittee = activeCommittee?.members.some(
                  (m) => m.userId === u.id && m.role === selectedRole
                );
                return (
                  <button
                    key={u.id}
                    type="button"
                    disabled={!!alreadyInCommittee}
                    onClick={() => setSelectedUserId(isSelected ? null : u.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isSelected
                        ? "bg-primary/10"
                        : alreadyInCommittee
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">
                      {u.name}
                      {alreadyInCommittee && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          (already assigned)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {u.email}
                      {u.studentId ? ` · ${u.studentId}` : ""}
                      {" · "}
                      {u.roles?.join(', ')}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {addMemberError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {addMemberError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddMember(false)}
              disabled={addingMember}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={addingMember || !selectedUserId || !selectedRole}
            >
              {addingMember ? "Adding..." : "Add to Committee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Past Committees ──────────────────────────────────── */}
      {pastCommittees.length > 0 && (
        <SectionCard
          title="Past Committees"
          description="Archived committee terms."
        >
          <div className="space-y-3">
            {pastCommittees.map((c) => {
              const isExpanded = expandedPast === c.id;
              return (
                <div key={c.id} className="rounded-2xl border border-border/70">
                  <button
                    type="button"
                    className="w-full text-left px-5 py-4 flex items-center justify-between"
                    onClick={() =>
                      setExpandedPast(isExpanded ? null : c.id)
                    }
                  >
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {c.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {fmt(c.termStart)} — {fmt(c.termEnd)} ·{" "}
                        {c.members.length} members
                      </p>
                    </div>
                    <span className="text-muted-foreground text-lg">
                      {isExpanded ? "▾" : "▸"}
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {sortedMembers(c.members).map((m) => (
                        <MemberCard key={m.id} member={m} />
                      ))}
                      {c.members.length === 0 && (
                        <p className="text-sm text-muted-foreground col-span-full">
                          No members were assigned.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

// ─── Helper: format date ────────────────────────────────────────────

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── Member Card Sub-component ──────────────────────────────────────

function MemberCard({
  member,
  onRemove,
  editable = false,
}: {
  member: CommitteeMember;
  onRemove?: () => void;
  editable?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border/70 p-4 flex flex-col gap-2">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {member.user.name}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {member.user.email}
            {member.user.studentId ? ` · ${member.user.studentId}` : ""}
          </p>
        </div>
        {editable && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors ml-2 shrink-0"
            title="Remove member"
          >
            ✕
          </button>
        )}
      </div>
      <Badge variant={ROLE_BADGE_VARIANT[member.role] || "outline"} className="w-fit">
        {ROLE_LABEL_MAP[member.role] || member.role}
      </Badge>
    </div>
  );
}
