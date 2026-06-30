"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed.");
      }

      router.push("/admin");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "480px", margin: "4rem auto", width: "100%" }} className="glass-card">
      <h1>Admin Portal</h1>
      <p className="subtitle">Sign in to manage library seats and audit occupancy.</p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Username
          </label>
          <input
            type="text"
            className="custom-input"
            style={{ textAlign: "left", letterSpacing: "normal", padding: "1rem 1.25rem", fontSize: "1.1rem" }}
            placeholder="e.g. admin"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            Password
          </label>
          <input
            type="password"
            className="custom-input"
            style={{ textAlign: "left", letterSpacing: "normal", padding: "1rem 1.25rem", fontSize: "1.1rem" }}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        {error && <div className="toast toast-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? "Authenticating..." : "Sign In"}
        </button>

        <button
          type="button"
          className="btn-secondary"
          style={{ marginTop: "1rem" }}
          onClick={() => router.push("/")}
          disabled={loading}
        >
          Student Portal
        </button>
      </form>
    </div>
  );
}
