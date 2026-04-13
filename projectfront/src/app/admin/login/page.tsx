"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The unified login at /login handles all roles.
// This page redirects there so old links still work.
export default function AdminLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return null;
}


export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const response = await login({
        email,
        password,
        role: "admin",
      });

      if (response.success) {
        // Redirect to admin dashboard
        const redirectPath = getRedirectPath(response.user);
        router.push(redirectPath);
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.message || "Login failed. Please check your credentials.";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 rounded-3xl border border-border/70 bg-card/80 p-8">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.25em] text-primary">Admin entry</p>
        <h1 className="text-3xl font-semibold text-foreground">Secure login</h1>
        <p className="text-sm text-muted-foreground">
          Email + password authentication with forced password change on first login.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="flex flex-col gap-2 text-sm">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base disabled:opacity-50"
            placeholder="admin@campus.edu"
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-base disabled:opacity-50"
            placeholder="••••••••"
          />
        </label>
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={rememberDevice}
              onChange={(e) => setRememberDevice(e.target.checked)}
              disabled={isLoading}
              className="rounded border border-border disabled:opacity-50"
            />
            Remember device
          </label>
          <a href="/admin/password-reset" className="text-primary hover:underline">
            Forgot password?
          </a>
        </div>
        <Button className="w-full" type="submit" disabled={isLoading}>
          {isLoading ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
