"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SectionSummary {
  section: string;
  total: number;
  occupied: number;
}

const LIBRARY_SECTIONS: { [library: string]: string[] } = {
  MAIN: ['reading_l1', 'reading_l2', 'reading_l3', 'reading_l4', 'block_a', 'block_b', 'block_c', 'block_d', 'auditorium'],
  MKDL: ['mkdl_reading', 'mkdl_reference', 'mkdl_block_a', 'mkdl_block_b'],
  MEDL: ['medl_reading', 'medl_reference', 'medl_block_a', 'medl_block_b'],
};

const SECTION_NAMES: { [key: string]: string } = {
  reading_l1: "Reading Section (Level 0)",
  reading_l2: "Reading Section (Level 1)",
  reading_l3: "Reading Section (Level 2)",
  reading_l4: "Reading Section (Basement)",
  block_a: "Block A",
  block_b: "Block B",
  block_c: "Block C",
  block_d: "Block D",
  auditorium: "Auditorium",
  mkdl_reading: "Reading Section (MKDL)",
  mkdl_reference: "Reference Section (MKDL)",
  mkdl_block_a: "Block A (MKDL)",
  mkdl_block_b: "Block B (MKDL)",
  medl_reading: "Reading Section (MEDL)",
  medl_reference: "Reference Section (MEDL)",
  medl_block_a: "Block A (MEDL)",
  medl_block_b: "Block B (MEDL)",
};

export default function Home() {
  const router = useRouter();
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Section availability summary state
  const [summaries, setSummaries] = useState<SectionSummary[]>([]);
  const [allSlots, setAllSlots] = useState<any[]>([]);
  
  // Library Selector State
  const [selectedLibrary, setSelectedLibrary] = useState<"MAIN" | "MKDL" | "MEDL">("MAIN");

  // Checkout flow states
  const [viewMode, setViewMode] = useState<"enter_reg" | "confirm_checkout" | "checkout_success">("enter_reg");
  const [activeReservation, setActiveReservation] = useState<any>(null);
  const [studentName, setStudentName] = useState("");

  // Kiosk/Terminal states
  const [isTerminalUnlocked, setIsTerminalUnlocked] = useState<boolean | null>(null);
  const [operatorUsername, setOperatorUsername] = useState("");
  const [operatorPassword, setOperatorPassword] = useState("");
  const [operatorLoading, setOperatorLoading] = useState(false);
  const [operatorError, setOperatorError] = useState<string | null>(null);

  // Check terminal lock status on mount
  useEffect(() => {
    checkTerminalStatus();
  }, []);

  // Load section summaries on mount (only when terminal is unlocked)
  useEffect(() => {
    if (isTerminalUnlocked !== true) return;
    
    fetchSummaries();
    const interval = setInterval(fetchSummaries, 8000); // refresh every 8s
    return () => clearInterval(interval);
  }, [isTerminalUnlocked]);

  const fetchSummaries = async () => {
    try {
      const res = await fetch("/api/slots");
      const data = await res.json();
      if (data.success) {
        if (data.summaries) setSummaries(data.summaries);
        if (data.slots) setAllSlots(data.slots);
      }
    } catch (err) {
      console.error("Failed to fetch section summaries:", err);
    }
  };

  const checkTerminalStatus = async () => {
    try {
      const res = await fetch("/api/terminal/status");
      const data = await res.json();
      if (data.success) {
        setIsTerminalUnlocked(data.unlocked);
      } else {
        setIsTerminalUnlocked(false);
      }
    } catch (err) {
      console.error("Failed to check terminal status:", err);
      setIsTerminalUnlocked(false);
    }
  };

  const handleUnlockTerminal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!operatorUsername.trim() || !operatorPassword.trim()) {
      setOperatorError("Please enter both username and password.");
      return;
    }

    setOperatorLoading(true);
    setOperatorError(null);

    try {
      const res = await fetch("/api/terminal/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: operatorUsername, password: operatorPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login failed.");
      }

      setOperatorUsername("");
      setOperatorPassword("");
      setOperatorError(null);
      setIsTerminalUnlocked(true);
    } catch (err: any) {
      setOperatorError(err.message);
    } finally {
      setOperatorLoading(false);
    }
  };

  const handleLockTerminal = async () => {
    if (!confirm("Are you sure you want to lock this terminal? Students will not be able to make reservations until it is unlocked again.")) {
      return;
    }
    try {
      const res = await fetch("/api/terminal/lock", { method: "POST" });
      if (res.ok) {
        setIsTerminalUnlocked(false);
        resetFlow();
      }
    } catch (err) {
      console.error("Failed to lock terminal:", err);
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
        if (data.activeReservation.isVisit) {
          setError("You already have an active visitor session. Please check-out first.");
        } else {
          setError(`You already have an active seat reservation in ${SECTION_NAMES[data.activeReservation.section]} - Seat #${data.activeReservation.slot_number}. Please check-out first.`);
        }
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

  const handleVisitCheckIn = async () => {
    if (!registrationNumber.trim()) {
      setError("Please enter your registration number.");
      return;
    }
    
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const authRes = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber }),
      });
      const authData = await authRes.json();

      if (!authRes.ok) {
        throw new Error(authData.error || "Verification failed.");
      }

      if (authData.activeReservation) {
        if (authData.activeReservation.isVisit) {
          throw new Error("You already have an active visitor session. Please check-out first.");
        } else {
          throw new Error(`You already have an active seat reservation in ${SECTION_NAMES[authData.activeReservation.section]} - Seat #${authData.activeReservation.slot_number}. Please check-out first.`);
        }
      }

      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Check-in failed.");
      }

      setSuccess("Successfully checked in as a visitor!");
      setViewMode("checkout_success");
    } catch (err: any) {
      setError(err.message);
    } finally {
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
        throw new Error("No active session found for this registration number.");
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

  if (isTerminalUnlocked === null) {
    return (
      <div className="glass-card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 2rem" }}>
        <div style={{ width: "40px", height: "40px", border: "4px solid rgba(255,255,255,0.1)", borderTop: "4px solid #a78bfa", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "1.5rem" }}></div>
        <h2>Checking Security...</h2>
        <p style={{ color: "var(--text-muted)", marginTop: "0.5rem" }}>Please wait while the terminal authenticates.</p>
      </div>
    );
  }

  if (isTerminalUnlocked === false) {
    return (
      <div className="glass-card" style={{ maxWidth: "480px", margin: "4rem auto", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: "3.5rem", marginBottom: "1rem" }}>🔒</div>
          <h1>Terminal Locked</h1>
          <p className="subtitle" style={{ fontSize: "0.95rem" }}>
            This terminal is currently locked. An operator or administrator must sign in to enable the seat reservation portal.
          </p>
        </div>

        <form onSubmit={handleUnlockTerminal}>
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Operator Username
            </label>
            <input
              type="text"
              className="custom-input"
              style={{ textAlign: "left", letterSpacing: "normal", padding: "1rem 1.25rem", fontSize: "1.1rem" }}
              placeholder="e.g. operator1"
              value={operatorUsername}
              onChange={(e) => setOperatorUsername(e.target.value)}
              disabled={operatorLoading}
              autoFocus
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
              value={operatorPassword}
              onChange={(e) => setOperatorPassword(e.target.value)}
              disabled={operatorLoading}
            />
          </div>

          {operatorError && <div className="toast toast-error" style={{ marginBottom: "1.5rem" }}>{operatorError}</div>}

          <button type="submit" className="btn-primary" disabled={operatorLoading}>
            {operatorLoading ? "Unlocking Terminal..." : "Unlock Kiosk"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="glass-card" style={{ position: "relative" }}>
      {/* Kiosk lock control in top-right */}
      <button 
        onClick={handleLockTerminal}
        style={{
          position: "absolute",
          top: "1.5rem",
          right: "1.5rem",
          background: "rgba(239, 68, 68, 0.15)",
          color: "#f87171",
          border: "1px solid rgba(239, 68, 68, 0.2)",
          padding: "0.4rem 0.8rem",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "0.85rem",
          fontWeight: "600",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(239, 68, 68, 0.25)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
        }}
      >
        🔒 Lock Terminal
      </button>

      <h1>Library Hub</h1>
      <p className="subtitle">Real-time attendance & study seat reservation portal.</p>

      {viewMode === "enter_reg" && (
        <>
          {/* Library Selector Tabs */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", justifyContent: "center", flexWrap: "wrap" }}>
            {(["MAIN", "MKDL", "MEDL"] as const).map(lib => (
              <button
                key={lib}
                type="button"
                onClick={() => setSelectedLibrary(lib)}
                style={{
                  padding: "0.6rem 1.5rem",
                  borderRadius: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  background: selectedLibrary === lib ? "linear-gradient(90deg, #a78bfa, #c084fc)" : "rgba(255, 255, 255, 0.03)",
                  color: selectedLibrary === lib ? "#fff" : "var(--text-muted)",
                  fontWeight: "600",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  boxShadow: selectedLibrary === lib ? "0 4px 12px rgba(167, 139, 250, 0.3)" : "none"
                }}
                onMouseEnter={(e) => {
                  if (selectedLibrary !== lib) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                }}
                onMouseLeave={(e) => {
                  if (selectedLibrary !== lib) e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                }}
              >
                {lib} Library
              </button>
            ))}
          </div>

          {/* Section Live Counters */}
          <div className="sections-grid">
            {LIBRARY_SECTIONS[selectedLibrary].map(key => {
              const { total, occupied } = getSectionAvailability(key);
              const available = total - occupied;
              const isFull = available === 0;

              return (
                <div key={key} className="section-card" style={{ display: "flex", flexDirection: "column", padding: "1.25rem" }}>
                  <h3 style={{ fontSize: "1.1rem" }}>{SECTION_NAMES[key]}</h3>
                  
                  {/* Progress bar indicating fill rate */}
                  <div style={{ width: "100%", background: "rgba(255,255,255,0.06)", height: "6px", borderRadius: "3px", overflow: "hidden", margin: "0.6rem 0" }}>
                    <div style={{ width: `${(occupied / total) * 100}%`, background: isFull ? "#ef4444" : "linear-gradient(90deg, #a78bfa, #c084fc)", height: "100%", borderRadius: "3px", transition: "width 0.3s ease" }}></div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", marginBottom: "0.25rem" }}>
                    <div style={{ fontSize: "1.25rem", fontWeight: "800" }}>
                      {available} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: "500" }}>/ {total} Free</span>
                    </div>
                    <span className={`availability-badge ${isFull ? 'badge-occupied' : 'badge-available'}`} style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem", lineHeight: "1" }}>
                      {isFull ? "FULL" : "FREE"}
                    </span>
                  </div>

                  {/* Micro seat grid showing exact layout */}
                  {allSlots.length > 0 && (() => {
                    const sectionSlots = allSlots.filter(s => s.section === key);
                    if (sectionSlots.length === 0) return null;
                    return (
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(10, 1fr)",
                        gap: "2.5px",
                        marginTop: "0.75rem",
                        background: "rgba(0,0,0,0.15)",
                        padding: "6px",
                        borderRadius: "6px",
                        width: "100%",
                        boxSizing: "border-box"
                      }}>
                        {sectionSlots.map((slot) => {
                          let dotColor = "#10b981"; // available (green)
                          if (slot.status === "occupied") {
                            dotColor = "#ef4444"; // occupied (red)
                          } else if (slot.status === "locked") {
                            dotColor = "#8b5cf6"; // locked (purple)
                          }
                          return (
                            <div
                              key={slot.slot_number}
                              style={{
                                aspectRatio: "1/1",
                                width: "100%",
                                borderRadius: "1.5px",
                                backgroundColor: dotColor,
                                opacity: slot.status === "available" ? 0.7 : 1,
                                transition: "all 0.3s ease"
                              }}
                              title={`Seat #${slot.slot_number} (${slot.status})`}
                            />
                          );
                        })}
                      </div>
                    );
                  })()}
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

            <div className="action-buttons-group" style={{ display: "flex", gap: "1rem", flexDirection: "column" }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? "Verifying..." : "Book Seat & Check-in"}
              </button>
              
              <div style={{ display: "flex", gap: "1rem", width: "100%" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1 }}
                  onClick={handleVisitCheckIn}
                  disabled={loading}
                >
                  {loading ? "Checking in..." : "Only Visit (No Seat)"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ flex: 1, border: "1px solid rgba(239, 68, 68, 0.2)", color: "#f87171" }}
                  onClick={handleCheckOutLookup}
                  disabled={loading}
                >
                  Checkout & Leave
                </button>
              </div>
            </div>
          </form>
        </>
      )}

      {viewMode === "confirm_checkout" && activeReservation && (
        <div style={{ animation: "fadeIn 0.3s" }}>
          <div className="active-res-details">
            <h2>Active Session Detected</h2>
            <div className="ticket-row" style={{ marginTop: "1rem" }}>
              <span className="ticket-label">Student Name:</span>
              <span className="ticket-value">{studentName}</span>
            </div>
            <div className="ticket-row">
              <span className="ticket-label">Reg Number:</span>
              <span className="ticket-value">{registrationNumber.toUpperCase()}</span>
            </div>
            {activeReservation.isVisit ? (
              <div className="ticket-row">
                <span className="ticket-label">Location:</span>
                <span className="ticket-value">Visitor (No Seat)</span>
              </div>
            ) : (
              <>
                <div className="ticket-row">
                  <span className="ticket-label">Location:</span>
                  <span className="ticket-value">{SECTION_NAMES[activeReservation.section]}</span>
                </div>
                <div className="ticket-row">
                  <span className="ticket-label">Seat Number:</span>
                  <span className="ticket-value">Seat #{activeReservation.slot_number}</span>
                </div>
              </>
            )}
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
              {loading ? "Checking out..." : activeReservation.isVisit ? "Confirm Checkout" : "Confirm Checkout & Free Seat"}
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
            <h2 style={{ color: "#34d399", fontWeight: "800", marginBottom: "1rem" }}>
              {success?.includes("visitor") || success?.includes("visitor") || success?.includes("visitor") || success?.includes("visitor") || success?.includes("visitor") ? "Check-in Complete" : "Checkout Complete"}
            </h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem", textAlign: "center" }}>
              {success?.includes("visitor") || success?.includes("visitor") || success?.includes("visitor") || success?.includes("visitor") || success?.includes("visitor")
                ? "You have successfully checked in as a visitor. Enjoy your visit!"
                : "Your session has been closed and any seat held has been released."}
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
