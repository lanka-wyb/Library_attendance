"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SectionSummary {
  section: string;
  total: number;
  occupied: number;
}

const SECTION_NAMES: { [key: string]: string } = {
  reading_l1: "Reading Section (Level 0)",
  reading_l2: "Reading Section (Level 1)",
  reading_l3: "Reading Section (Level 2)",
  reading_l4: "Reading Section (Basement)",
  block_a: "Block A",
  block_b: "Block B",
  block_c: "Block C",
  block_d: "Block D",
};

export default function Home() {
  const router = useRouter();
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Section availability summary state
  const [summaries, setSummaries] = useState<SectionSummary[]>([]);
  
  // Checkout flow states
  const [viewMode, setViewMode] = useState<"enter_reg" | "confirm_checkout" | "checkout_success">("enter_reg");
  const [activeReservation, setActiveReservation] = useState<any>(null);
  const [studentName, setStudentName] = useState("");

  // Load section summaries on mount
  useEffect(() => {
    fetchSummaries();
    const interval = setInterval(fetchSummaries, 8000); // refresh every 8s
    return () => clearInterval(interval);
  }, []);

  const fetchSummaries = async () => {
    try {
      const res = await fetch("/api/slots");
      const data = await res.json();
      if (data.success && data.summaries) {
        setSummaries(data.summaries);
      }
    } catch (err) {
      console.error("Failed to fetch section summaries:", err);
    }
  };

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registrationNumber.trim()) {
      setError("Please enter your registration number.");
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong.");
      }

      if (data.activeReservation) {
        setError(`You already have an active seat reservation in ${SECTION_NAMES[data.activeReservation.section]} - Seat #${data.activeReservation.slot_number}. Please check-out first.`);
        setLoading(false);
      } else {
        // Redirect to seat selector with registration number
        router.push(`/select-slot?reg=${encodeURIComponent(data.user.registration_number)}`);
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleCheckOutLookup = async () => {
    if (!registrationNumber.trim()) {
      setError("Please enter your registration number.");
      return;
    }

    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Verification failed.");
      }

      if (!data.activeReservation) {
        throw new Error("No active seat reservation found for this registration number.");
      }

      setStudentName(data.user.name);
      setActiveReservation(data.activeReservation);
      setViewMode("confirm_checkout");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to check-out.");
      }

      setSuccess(data.message);
      setViewMode("checkout_success");
      fetchSummaries(); // Refresh dashboard counts
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setRegistrationNumber("");
    setError(null);
    setSuccess(null);
    setActiveReservation(null);
    setViewMode("enter_reg");
  };

  // Helper to get remaining slot counts
  const getSectionAvailability = (secKey: string) => {
    const sum = summaries.find(s => s.section === secKey);
    if (!sum) return { total: secKey.includes("block") ? 50 : 100, occupied: 0 };
    return { total: sum.total, occupied: parseInt(sum.occupied as any || 0, 10) };
  };

  return (
    <div className="glass-card">
      <h1>Library Hub</h1>
      <p className="subtitle">Real-time attendance & study seat reservation portal.</p>

      {viewMode === "enter_reg" && (
        <>
          {/* Section Live Counters */}
          <div className="sections-grid">
            {Object.keys(SECTION_NAMES).map(key => {
              const { total, occupied } = getSectionAvailability(key);
              const available = total - occupied;
              const isFull = available === 0;

              return (
                <div key={key} className="section-card">
                  <h3>{SECTION_NAMES[key]}</h3>
                  <div style={{ fontSize: "1.5rem", fontWeight: "800", margin: "0.2rem 0" }}>
                    {available} <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: "500" }}>/ {total} Free</span>
                  </div>
                  <span className={`availability-badge ${isFull ? 'badge-occupied' : 'badge-available'}`}>
                    {isFull ? "FULL" : "SEATS AVAILABLE"}
                  </span>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleCheckInSubmit}>
            <div className="input-group">
              <input
                type="text"
                className="custom-input"
                placeholder="ENTER REGISTRATION NUMBER (e.g. REG001)"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && <div className="toast toast-error">{error}</div>}

            <div className="action-buttons-group">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Book Seat & Check-in"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCheckOutLookup}
                disabled={loading}
              >
                Checkout & Leave Seat
              </button>
            </div>
          </form>
        </>
      )}

      {viewMode === "confirm_checkout" && activeReservation && (
        <div style={{ animation: "fadeIn 0.3s" }}>
          <div className="active-res-details">
            <h2>Active Reservation Detected</h2>
            <div className="ticket-row" style={{ marginTop: "1rem" }}>
              <span className="ticket-label">Student Name:</span>
              <span className="ticket-value">{studentName}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Reg Number:</span>
              <span className="ticket-value">{registrationNumber.toUpperCase()}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Location:</span>
              <span className="ticket-value">{SECTION_NAMES[activeReservation.section]}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Seat Number:</span>
              <span className="ticket-value">Seat #{activeReservation.slot_number}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Check-in Time:</span>
              <span className="ticket-value">
                {new Date(activeReservation.occupied_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {error && <div className="toast toast-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

          <div className="action-buttons-group">
            <button
              onClick={handleConfirmCheckout}
              className="btn-danger"
              disabled={loading}
            >
              {loading ? "Checking out..." : "Confirm Checkout & Free Seat"}
            </button>
            <button
              onClick={resetFlow}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {viewMode === "checkout_success" && (
        <div>
          <div className="ticket-container">
            <div style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>✓</div>
            <h2 style={{ color: "#34d399", fontWeight: "800", marginBottom: "1rem" }}>Checkout Complete</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", textAlign: "center" }}>
              Your seat has been released and is now available for other students.
            </p>
            {success && <div className="toast toast-success" style={{ width: "100%", maxWidth: "320px" }}>{success}</div>}
          </div>

          <button onClick={resetFlow} className="btn-primary">
            Done
          </button>
        </div>
      )}
    </div>
  );
}
