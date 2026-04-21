"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, CheckCheck, RefreshCw } from "lucide-react";
import { CseLogo } from "@/components/branding/cse-logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredUser, logout, isAuthenticated } from "@/lib/auth";
import { notificationAPI, type NotificationItem } from "@/lib/api";
import type { User } from "@/lib/auth";

// Nav entry per role — only shown when user has that role
const ROLE_NAV: Record<string, { href: string; label: string }> = {
  student: { href: "/student", label: "Student" },
  society: { href: "/society", label: "Society" },
  admin:   { href: "/admin",   label: "Admin" },
};

const registerRoleOptions = [
  { value: "student", label: "Student",        icon: "🎓" },
  { value: "admin",   label: "Admin",          icon: "👨‍💼" },
  { value: "society", label: "Society Member", icon: "👥" },
];

export function SiteHeader() {
  const [user, setUser]               = useState<User | null>(null);
  const [mounted, setMounted]         = useState(false);
  const [showSignUpModal, setShowSignUpModal] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const notificationPanelRef = useRef<HTMLDivElement | null>(null);
  const router   = useRouter();
  const pathname = usePathname();
  const isStudentUser = !!user?.roles?.includes("student");

  // Sync auth state on mount + whenever localStorage changes (e.g. login in another tab)
  useEffect(() => {
    const sync = () => setUser(isAuthenticated() ? getStoredUser() : null);
    sync();
    setMounted(true);
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Re-sync on every navigation (handles login/logout within same tab)
  useEffect(() => {
    setUser(isAuthenticated() ? getStoredUser() : null);
  }, [pathname]);

  const loadNotifications = useCallback(async () => {
    if (!isStudentUser) {
      return;
    }

    setIsNotificationsLoading(true);
    setNotificationsError("");
    try {
      const [listResponse, countResponse] = await Promise.all([
        notificationAPI.getMyNotifications({ limit: 30 }),
        notificationAPI.getUnreadCount(),
      ]);
      setNotifications(listResponse.notifications || []);
      setUnreadCount(countResponse.unreadCount || 0);
    } catch (error) {
      console.error("Load notifications error:", error);
      setNotificationsError("Failed to load notifications");
    } finally {
      setIsNotificationsLoading(false);
    }
  }, [isStudentUser]);

  useEffect(() => {
    if (!mounted || !isStudentUser) {
      setNotifications([]);
      setUnreadCount(0);
      setIsNotificationsOpen(false);
      return;
    }

    loadNotifications();
  }, [mounted, isStudentUser, user?.id, loadNotifications]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!notificationPanelRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    if (isNotificationsOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isNotificationsOpen]);

  const handleMarkOneRead = async (notificationId: string) => {
    try {
      const response = await notificationAPI.markAsRead(notificationId);
      setNotifications((prev) => prev.map((item) => (
        item.id === notificationId ? response.notification : item
      )));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Mark notification as read error:", error);
      setNotificationsError("Failed to mark notification as read");
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationAPI.markAllAsRead();
      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => (
        item.isRead ? item : { ...item, isRead: true, readAt: nowIso }
      )));
      setUnreadCount(0);
    } catch (error) {
      console.error("Mark all notifications as read error:", error);
      setNotificationsError("Failed to mark all notifications as read");
    }
  };

  const handleToggleNotifications = () => {
    if (!isNotificationsOpen) {
      loadNotifications();
    }
    setIsNotificationsOpen((prev) => !prev);
  };

  const handleNotificationClick = async (notification: NotificationItem) => {
    if (!notification.eventId) {
      return;
    }

    if (!notification.isRead) {
      try {
        const response = await notificationAPI.markAsRead(notification.id);
        setNotifications((prev) => prev.map((item) => (
          item.id === notification.id ? response.notification : item
        )));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Mark notification as read on click error:", error);
      }
    }

    setIsNotificationsOpen(false);
    router.push(`/events/${notification.eventId}`);
  };

  const formatNotificationDate = (isoString: string) => {
    const parsed = new Date(isoString);
    if (Number.isNaN(parsed.getTime())) {
      return "Unknown time";
    }
    return parsed.toLocaleString();
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    router.push("/");
  };

  const handleSignUpRoleSelect = (role: string) => {
    setShowSignUpModal(false);
    router.push(`/register?role=${role}`);
  };

  // Build nav links: Home always, then one per role the user holds
  const userNavLinks = user?.roles
    ? (user.roles.map((r) => ROLE_NAV[r]).filter(Boolean) as { href: string; label: string }[])
    : [];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/20 bg-linear-to-r from-[#1d3b72] via-[#2c4f8f] to-[#3a63ac] text-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-semibold text-white">
            <CseLogo className="h-10 w-auto" />
            <span className="tracking-tight">CSE Society Event & Budget Management</span>
          </Link>

          <div className="flex items-center gap-6">
            {/* Nav — always shows Home; shows role dashboards only when logged in */}
            <nav className="hidden items-center gap-6 text-base font-medium text-white/80 md:flex">
              <Link href="/" className="transition-colors hover:text-white">
                Home
              </Link>
              {mounted && userNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="transition-colors hover:text-white"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Auth controls */}
            {!mounted ? null : user ? (
              <div className="flex items-center gap-3">
                {isStudentUser && (
                  <div className="relative" ref={notificationPanelRef}>
                    <Button
                      variant="ghost"
                      className="relative text-white hover:bg-white/10 hover:text-white"
                      onClick={handleToggleNotifications}
                      aria-label="Open notifications"
                    >
                      <Bell className="h-5 w-5" />
                      {unreadCount > 0 && (
                        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </Button>

                    {isNotificationsOpen && (
                      <div className="absolute right-0 top-12 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white text-slate-900 shadow-lg">
                        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold">Notifications</p>
                            <p className="text-xs text-slate-600">Student updates from society events</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-slate-700 hover:bg-slate-100"
                              onClick={loadNotifications}
                              aria-label="Refresh notifications"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 px-2 text-slate-700 hover:bg-slate-100"
                              onClick={handleMarkAllRead}
                              disabled={unreadCount === 0}
                            >
                              <CheckCheck className="mr-1 h-4 w-4" />
                              Mark all
                            </Button>
                          </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto px-4 py-3">
                          {notificationsError ? (
                            <p className="text-sm text-red-600">{notificationsError}</p>
                          ) : isNotificationsLoading ? (
                            <p className="text-sm text-slate-600">Loading notifications...</p>
                          ) : notifications.length === 0 ? (
                            <p className="text-sm text-slate-600">No notifications yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {notifications.map((notification) => (
                                <div
                                  key={notification.id}
                                  className={`rounded-lg border p-3 ${notification.isRead ? "border-slate-200 bg-slate-50" : "border-blue-200 bg-blue-50"} ${notification.eventId ? "cursor-pointer transition-colors hover:border-slate-300 hover:bg-slate-100" : ""}`}
                                  onClick={() => handleNotificationClick(notification)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      handleNotificationClick(notification);
                                    }
                                  }}
                                  role={notification.eventId ? "button" : undefined}
                                  tabIndex={notification.eventId ? 0 : -1}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold text-slate-900">{notification.title}</p>
                                      <p className="mt-1 text-sm text-slate-700">{notification.message}</p>
                                      <p className="mt-2 text-xs text-slate-500">
                                        {formatNotificationDate(notification.createdAt)}
                                      </p>
                                    </div>
                                    {!notification.isRead && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 px-2 text-xs text-slate-700 hover:bg-slate-100"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          handleMarkOneRead(notification.id);
                                        }}
                                      >
                                        Mark read
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <span className="hidden text-sm text-white/80 md:block">
                  {user.name}
                </span>
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={handleLogout}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  className="text-white hover:bg-white/10 hover:text-white"
                  onClick={() => router.push("/login")}
                >
                  Login
                </Button>
                <Button
                  className="bg-white text-[#1d3b72] hover:bg-white/90"
                  onClick={() => setShowSignUpModal(true)}
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Sign Up role picker modal */}
      <Dialog open={showSignUpModal} onOpenChange={setShowSignUpModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">Select Your Role</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            {registerRoleOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex cursor-pointer items-center gap-4 rounded-lg border border-border p-4 hover:bg-muted/40"
              >
                <input
                  type="radio"
                  name="signup-role"
                  value={opt.value}
                  onChange={() => handleSignUpRoleSelect(opt.value)}
                  className="h-4 w-4"
                />
                <span className="text-xl">{opt.icon}</span>
                <h3 className="font-semibold">{opt.label}</h3>
              </label>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
