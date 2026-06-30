"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Slot {
  id: number;
  section: string;
  slot_number: number;
  status: string;
  occupied_by: string | null;
  occupied_at: string | null;
  occupant_name: string | null;
}

interface ReportLog {
  id: number;
  registration_number: string;
  section: string;
  slot_number: number;
  checkin_time: string;
  checkout_time: string | null;
  student_name: string;
}

const SECTION_NAMES: { [key: string]: string } = {
  reading_l1: "Reading Section (Level 1)",
  reading_l2: "Reading Section (Level 2)",
  block_a: "Block A",
  block_b: "Block B",
};

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"visualizer" | "reports">("visualizer");

  // Visualizer states
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSection, setSelectedSection] = useState("reading_l1");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSeat, setActiveSeat] = useState<Slot | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Reports states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reportLogs, setReportLogs] = useState<ReportLog[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // 1. Setup default dates on mount (avoid SSR hydration mismatch)
  useEffect(() => {
    const today = new Date();
    const endStr = today.toISOString().split("T")[0];
    
    const past = new Date();
    past.setDate(past.getDate() - 7);
    const startStr = past.toISOString().split("T")[0];
    
    setStartDate(startStr);
    setEndDate(endStr);
  }, []);

  // 2. Fetch slots on load and periodically
  useEffect(() => {
    fetchSlots();
    const interval = setInterval(fetchSlots, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchSlots = async () => {
    try {
      const res = await fetch("/api/admin/slots");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch slots");
      setSlots(data.slots || []);
    } catch (err: any) {
      console.error(err);
      setError("Failed to synchronize seat configurations.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const res = await fetch("/api/admin/auth", { method: "DELETE" });
      if (res.ok) {
        router.push("/admin/login");
      }
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleLockToggle = async (slot: Slot, action: "lock" | "unlock") => {
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: slot.section,
          slotNumber: slot.slot_number,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} seat.`);

      setSuccess(data.message);
      
      const updatedSlots = slots.map(s => {
        if (s.section === slot.section && s.slot_number === slot.slot_number) {
          const updated = { ...s, status: action === "lock" ? "locked" : "available" };
          if (activeSeat && activeSeat.id === s.id) {
            setActiveSeat(updated);
          }
          return updated;
        }
        return s;
      });
      setSlots(updatedSlots);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleForceRelease = async (slot: Slot) => {
    if (!confirm(`Are you sure you want to force-release Seat #${slot.slot_number} in ${SECTION_NAMES[slot.section]}?`)) {
      return;
    }
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: slot.section,
          slotNumber: slot.slot_number,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to release seat.");

      setSuccess(data.message);

      const updatedSlots = slots.map(s => {
        if (s.section === slot.section && s.slot_number === slot.slot_number) {
          const updated = { ...s, status: "available", occupied_by: null, occupied_at: null, occupant_name: null };
          if (activeSeat && activeSeat.id === s.id) {
            setActiveSeat(updated);
          }
          return updated;
        }
        return s;
      });
      setSlots(updatedSlots);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Generate Report function
  const handleGenerateReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      setReportError("Please select a valid start and end date.");
      return;
    }

    setReportLoading(true);
    setReportError(null);

    try {
      const res = await fetch(`/api/admin/report?startDate=${startDate}&endDate=${endDate}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to retrieve logs.");
      }

      setReportLogs(data.logs || []);
    } catch (err: any) {
      setReportError(err.message);
    } finally {
      setReportLoading(false);
    }
  };

  // Export CSV function (Blob based)
  const handleExportCSV = () => {
    if (reportLogs.length === 0) return;

    const headers = [
      "Registration Number",
      "Student Name",
      "Section",
      "Seat Number",
      "Check-in Time",
      "Check-out Time",
      "Study Duration"
    ];

    const rows = reportLogs.map(log => [
      log.registration_number,
      log.student_name,
      SECTION_NAMES[log.section] || log.section,
      `Seat #${log.slot_number}`,
      new Date(log.checkin_time).toLocaleString(),
      log.checkout_time ? new Date(log.checkout_time).toLocaleString() : "Active (In Progress)",
      calculateDuration(log.checkin_time, log.checkout_time)
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `library_usage_report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate study duration string
  const calculateDuration = (checkin: string, checkout: string | null) => {
    if (!checkout) return "Active (In Progress)";
    const start = new Date(checkin).getTime();
    const end = new Date(checkout).getTime();
    const diffMs = end - start;

    if (isNaN(diffMs) || diffMs < 0) return "N/A";

    const diffMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  };

  // Visualizer Helpers
  const getFilteredSlots = () => {
    return slots.filter(s => s.section === selectedSection);
  };

  const getStats = () => {
    const total = slots.length;
    const occupied = slots.filter(s => s.status === "occupied").length;
    const locked = slots.filter(s => s.status === "locked").length;
    const available = total - occupied - locked;
    return { total, occupied, locked, available };
  };

  const getSearchMatch = () => {
    if (!searchQuery.trim()) return null;
    const query = searchQuery.toLowerCase().trim();
    return slots.find(s => 
      (s.occupied_by && s.occupied_by.toLowerCase().includes(query)) ||
      (s.occupant_name && s.occupant_name.toLowerCase().includes(query))
    );
  };

  const matchedSlot = getSearchMatch();

  useEffect(() => {
    if (matchedSlot) {
      setSelectedSection(matchedSlot.section);
      setActiveSeat(matchedSlot);
    }
  }, [searchQuery]);

  const { total, occupied, locked, available } = getStats();

  return (
    <div className="glass-card">
      {/* Navigation Header */}
      <div className="admin-navbar">
        <h2>Admin Portal</h2>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button onClick={() => router.push("/")} className="btn-secondary" style={{ padding: "0.5rem 1rem", fontSize: "0.95rem", width: "auto" }}>
            Student View
          </button>
          <button onClick={handleLogout} className="btn-danger" style={{ padding: "0.5rem 1rem", fontSize: "0.95rem", width: "auto", boxShadow: "none" }}>
            Sign Out
          </button>
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="tab-nav">
        <button 
          className={`tab-btn ${activeTab === 'visualizer' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('visualizer');
            setError(null);
            setSuccess(null);
          }}
        >
          Seat Visualizer
        </button>
        <button 
          className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('reports');
            setReportError(null);
          }}
        >
          Usage Reports
        </button>
      </div>

      {activeTab === "visualizer" && (
        <div style={{ animation: "fadeIn 0.3s" }}>
          <h1>System Overview</h1>
          <p className="subtitle">Real-time seat auditing, manually release reservations, or lock slots.</p>

          {/* Live Stats */}
          <div className="admin-stat-summary">
            <div className="admin-stat-box">
              <div className="admin-stat-val" style={{ color: "#a78bfa" }}>{total}</div>
              <div className="admin-stat-label">Total Seats</div>
            </div>
            <div className="admin-stat-box">
              <div className="admin-stat-val" style={{ color: "var(--seat-avail-color)" }}>{available}</div>
              <div className="admin-stat-label">Available</div>
            </div>
            <div className="admin-stat-box">
              <div className="admin-stat-val" style={{ color: "var(--seat-occ-color)" }}>{occupied}</div>
              <div className="admin-stat-label">Occupied</div>
            </div>
            <div className="admin-stat-box">
              <div className="admin-stat-val" style={{ color: "var(--seat-locked-color)" }}>{locked}</div>
              <div className="admin-stat-label">Locked</div>
            </div>
          </div>

          {/* Student Finder Search */}
          <div style={{ margin: "1.5rem 0" }}>
            <input
              type="text"
              className="custom-input"
              placeholder="🔍 SEARCH STUDENT REG NUMBER OR NAME..."
              style={{ padding: "0.9rem 1.5rem", fontSize: "1.1rem" }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && !matchedSlot && (
              <div style={{ color: "var(--error)", fontSize: "0.9rem", marginTop: "0.5rem", textAlign: "center" }}>
                No active seat reservation matches this student name or registration number.
              </div>
            )}
            {matchedSlot && (
              <div style={{ color: "var(--success)", fontSize: "0.9rem", marginTop: "0.5rem", textAlign: "center" }}>
                Student found in {SECTION_NAMES[matchedSlot.section]} - Seat #{matchedSlot.slot_number}!
              </div>
            )}
          </div>

          {/* Section Tabs */}
          <div className="sections-grid">
            {Object.keys(SECTION_NAMES).map(key => {
              const isActive = selectedSection === key;
              return (
                <div
                  key={key}
                  className={`section-card ${isActive ? "active" : ""}`}
                  onClick={() => {
                    setSelectedSection(key);
                    setActiveSeat(null);
                  }}
                >
                  <h3>{SECTION_NAMES[key]}</h3>
                </div>
              );
            })}
          </div>

          {/* Map Display */}
          <div className="seats-map-container" style={{ marginTop: "0" }}>
            <div className="map-header">
              <div className="map-title">{SECTION_NAMES[selectedSection]} Visualizer</div>
              <div className="legend">
                <div className="legend-item">
                  <div className="legend-dot available"></div> Available
                </div>
                <div className="legend-item">
                  <div className="legend-dot occupied"></div> Occupied
                </div>
                <div className="legend-item">
                  <div className="legend-dot locked"></div> Locked
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--text-muted)" }}>
                Loading database configs...
              </div>
            ) : (
              <div className="seat-grid">
                {getFilteredSlots().map((slot) => {
                  const isSelected = activeSeat?.id === slot.id;
                  const isMatched = matchedSlot?.id === slot.id;
                  let seatClass = "seat admin-clickable ";
                  
                  if (slot.status === "occupied") {
                    seatClass += "occupied";
                  } else if (slot.status === "locked") {
                    seatClass += "locked";
                  } else {
                    seatClass += "available";
                  }

                  if (isSelected || isMatched) {
                    seatClass += " selected";
                  }

                  return (
                    <div
                      key={slot.id}
                      className={seatClass}
                      onClick={() => {
                        setActiveSeat(slot);
                        setError(null);
                        setSuccess(null);
                      }}
                      title={`Seat #${slot.slot_number} (${slot.status})`}
                    >
                      {slot.slot_number}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Admin Action / Detail Panel */}
          {activeSeat && (
            <div className="admin-detail-panel">
              <div className="admin-detail-title">
                Seat Details: Seat #{activeSeat.slot_number} in {SECTION_NAMES[activeSeat.section]}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div className="ticket-row">
                  <span className="ticket-label">Current Status:</span>
                  <span className={`availability-badge ${
                    activeSeat.status === "occupied" ? "badge-occupied" : 
                    activeSeat.status === "locked" ? "badge-locked" : "badge-available"
                  }`}>
                    {activeSeat.status.toUpperCase()}
                  </span>
                </div>

                {activeSeat.status === "occupied" && (
                  <>
                    <div className="ticket-row">
                      <span className="ticket-label">Occupied By:</span>
                      <span className="ticket-value">{activeSeat.occupant_name || "Unknown"}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="ticket-label">Reg ID:</span>
                      <span className="ticket-value">{activeSeat.occupied_by}</span>
                    </div>
                    <div className="ticket-row">
                      <span className="ticket-label">Check-in Time:</span>
                      <span className="ticket-value">
                        {activeSeat.occupied_at ? new Date(activeSeat.occupied_at).toLocaleString() : "N/A"}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {error && <div className="toast toast-error">{error}</div>}
              {success && <div className="toast toast-success">{success}</div>}

              <div className="admin-action-btn-group">
                {activeSeat.status === "occupied" && (
                  <button
                    onClick={() => handleForceRelease(activeSeat)}
                    className="btn-danger"
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Releasing..." : "Force Release Seat (Check-out)"}
                  </button>
                )}
                {activeSeat.status === "available" && (
                  <button
                    onClick={() => handleLockToggle(activeSeat, "lock")}
                    className="btn-secondary"
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Locking..." : "Lock Seat (Disable Booking)"}
                  </button>
                )}
                {activeSeat.status === "locked" && (
                  <button
                    onClick={() => handleLockToggle(activeSeat, "unlock")}
                    className="btn-primary"
                    style={{ width: "auto" }}
                    disabled={actionLoading}
                  >
                    {actionLoading ? "Unlocking..." : "Unlock Seat (Enable Booking)"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "reports" && (
        <div className="report-section">
          <h1>Usage Reports</h1>
          <p className="subtitle">Audit student reservations and export logs by picking a date range.</p>

          {/* Date Picker controls */}
          <form onSubmit={handleGenerateReport} className="report-controls">
            <div className="report-date-input-group">
              <label>Start Date</label>
              <input
                type="date"
                className="report-date-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="report-date-input-group">
              <label>End Date</label>
              <input
                type="date"
                className="report-date-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <button type="submit" className="btn-primary" style={{ width: "auto", padding: "0.85rem 1.5rem", fontSize: "1rem" }} disabled={reportLoading}>
                {reportLoading ? "Querying..." : "Generate Report"}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ width: "auto", padding: "0.85rem 1.5rem", fontSize: "1rem" }}
                onClick={handleExportCSV}
                disabled={reportLogs.length === 0}
              >
                Export CSV
              </button>
            </div>
          </form>

          {reportError && <div className="toast toast-error" style={{ marginBottom: "1.5rem" }}>{reportError}</div>}

          {/* Table display */}
          {reportLoading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--text-muted)", fontSize: "1.2rem" }}>
              Compiling database records...
            </div>
          ) : reportLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--text-muted)", background: "rgba(0,0,0,0.15)", borderRadius: "20px" }}>
              No reservation logs found for the selected date range.
            </div>
          ) : (
            <div className="report-table-wrapper">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Reg ID</th>
                    <th>Student Name</th>
                    <th>Location</th>
                    <th>Seat #</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {reportLogs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: "700", color: "#a78bfa" }}>{log.registration_number}</td>
                      <td>{log.student_name}</td>
                      <td>{SECTION_NAMES[log.section] || log.section}</td>
                      <td>Seat #{log.slot_number}</td>
                      <td>{new Date(log.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(log.checkin_time).toLocaleDateString()})</td>
                      <td>
                        {log.checkout_time ? (
                          `${new Date(log.checkout_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${new Date(log.checkout_time).toLocaleDateString()})`
                        ) : (
                          <span className="duration-active">Active</span>
                        )}
                      </td>
                      <td className={!log.checkout_time ? "duration-active" : ""}>
                        {calculateDuration(log.checkin_time, log.checkout_time)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
