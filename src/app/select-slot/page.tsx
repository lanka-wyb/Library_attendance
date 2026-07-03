"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

interface Slot {
  id: number;
  section: string;
  slot_number: number;
  status: string;
  occupied_by: string | null;
  occupied_at: string | null;
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

function SeatSelectorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const regNum = searchParams.get("reg") || "";

  const [studentName, setStudentName] = useState("");
  const [assignedLibrary, setAssignedLibrary] = useState<"MAIN" | "MKDL" | "MEDL" | null>(null);
  const [selectedLibrary, setSelectedLibrary] = useState<"MAIN" | "MKDL" | "MEDL">("MAIN");
  const [selectedSection, setSelectedSection] = useState("reading_l1");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Auto reset active section when changing libraries
  useEffect(() => {
    setSelectedSection(LIBRARY_SECTIONS[selectedLibrary][0]);
    setSelectedSlot(null);
  }, [selectedLibrary]);
  const [error, setError] = useState<string | null>(null);
  
  // Confirmation state
  const [confirmedReservation, setConfirmedReservation] = useState<{
    section: string;
    slotNumber: number;
    time: string;
  } | null>(null);

  // 1. Check if terminal is unlocked on mount
  useEffect(() => {
    const checkTerminal = async () => {
      try {
        const res = await fetch("/api/terminal/status");
        const data = await res.json();
        if (!data.unlocked) {
          router.push("/");
        }
      } catch (err) {
        console.error("Terminal status check error:", err);
        router.push("/");
      }
    };
    checkTerminal();
  }, []);

  // 2. Verify user exists and check active reservation on mount
  useEffect(() => {
    if (!regNum) {
      router.push("/");
      return;
    }
    verifyUser();
  }, [regNum]);

  // 2. Fetch slots when section changes
  useEffect(() => {
    if (regNum) {
      fetchSlots(selectedSection);
    }
  }, [selectedSection, regNum]);

  const verifyUser = async () => {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationNumber: regNum }),
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }
      
      setStudentName(data.user.name);
      if (data.assignedLibrary) {
        setAssignedLibrary(data.assignedLibrary);
        setSelectedLibrary(data.assignedLibrary);
      }
      
      if (data.activeReservation) {
        // Already checked in, redirect back
        router.push("/");
      }
    } catch (err: any) {
      setError(err.message);
      setTimeout(() => router.push("/"), 3000);
    }
  };

  const fetchSlots = async (section: string) => {
    setLoading(true);
    setSelectedSlot(null);
    setError(null);
    try {
      const res = await fetch(`/api/slots?section=${section}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load seats");
      setSlots(data.slots || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSeatClick = (slot: Slot) => {
    if (slot.status === "occupied" || slot.status === "locked") return;
    setSelectedSlot(slot.slot_number === selectedSlot ? null : slot.slot_number);
  };

  const handleConfirmReservation = async () => {
    if (!selectedSlot) return;
    setBookingLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registrationNumber: regNum,
          section: selectedSection,
          slotNumber: selectedSlot,
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reservation failed");

      setConfirmedReservation({
        section: selectedSection,
        slotNumber: selectedSlot,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err: any) {
      setError(err.message);
      // Reload slots in case the selection was out-of-date
      fetchSlots(selectedSection);
    } finally {
      setBookingLoading(false);
    }
  };

  const getOccupiedCount = () => {
    return slots.filter(s => s.status === "occupied").length;
  };

  if (confirmedReservation) {
    return (
      <div className="glass-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
        <div className="ticket-container">
          <div style={{ fontSize: "3.5rem", marginBottom: "0.5rem" }}>🎉</div>
          <h2 style={{ color: "#34d399", fontWeight: "800", marginBottom: "1.5rem", fontSize: "1.8rem" }}>
            Reservation Confirmed!
          </h2>
          
          <div className="ticket-row">
            <span className="ticket-label">Student:</span>
            <span className="ticket-value">{studentName}</span>
          </div>
          <div className="ticket-row">
            <span className="ticket-label">Reg ID:</span>
            <span className="ticket-value">{regNum.toUpperCase()}</span>
          </div>
          <div className="ticket-row">
            <span className="ticket-label">Section:</span>
            <span className="ticket-value">{SECTION_NAMES[confirmedReservation.section]}</span>
          </div>
          <div className="ticket-row">
            <span className="ticket-label">Seat Assignment:</span>
            <span className="ticket-value">Seat #{confirmedReservation.slotNumber}</span>
          </div>
          <div className="ticket-row">
            <span className="ticket-label">Entry Logged:</span>
            <span className="ticket-value">{confirmedReservation.time}</span>
          </div>
        </div>

        <button onClick={() => router.push("/")} className="btn-primary">
          Return to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "1rem" }}>
        <h1>Choose Your Study Space</h1>
        <div style={{ color: "var(--text-muted)", fontSize: "1.1rem" }}>
          Welcome, <span style={{ color: "#c084fc", fontWeight: "700" }}>{studentName || "Student"}</span>
        </div>
      </div>
      <p className="subtitle" style={{ textAlign: "left", marginInline: "0" }}>
        Select a section and click on an available seat to book.
      </p>

      {/* Library Selector Tabs */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap", alignItems: "center" }}>
        {(["MAIN", "MKDL", "MEDL"] as const).map(lib => {
          const isAssigned = assignedLibrary === null || assignedLibrary === lib;
          return (
            <button
              key={lib}
              type="button"
              disabled={!isAssigned}
              onClick={() => setSelectedLibrary(lib)}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                background: selectedLibrary === lib ? "linear-gradient(90deg, #a78bfa, #c084fc)" : "rgba(255, 255, 255, 0.03)",
                color: selectedLibrary === lib ? "#fff" : "var(--text-muted)",
                fontWeight: "600",
                cursor: isAssigned ? "pointer" : "not-allowed",
                opacity: isAssigned ? 1 : 0.4,
                transition: "all 0.2s ease",
                boxShadow: selectedLibrary === lib ? "0 4px 12px rgba(167, 139, 250, 0.2)" : "none"
              }}
              onMouseEnter={(e) => {
                if (isAssigned && selectedLibrary !== lib) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              }}
              onMouseLeave={(e) => {
                if (isAssigned && selectedLibrary !== lib) e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
              }}
            >
              {lib} Library
            </button>
          );
        })}
        {assignedLibrary ? (
          <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            (You are officially assigned to the <strong style={{ color: "#a78bfa" }}>{assignedLibrary} Library</strong> based on your registration number)
          </span>
        ) : (
          assignedLibrary === null && (
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
              (You have unrestricted access to reserve seats at any library branch)
            </span>
          )
        )}
      </div>

      {/* Section Tabs */}
      <div className="sections-grid">
        {LIBRARY_SECTIONS[selectedLibrary].map(key => {
          const isActive = selectedSection === key;
          return (
            <div
              key={key}
              className={`section-card ${isActive ? "active" : ""}`}
              onClick={() => setSelectedSection(key)}
            >
              <h3>{SECTION_NAMES[key]}</h3>
            </div>
          );
        })}
      </div>

      {error && <div className="toast toast-error" style={{ marginBottom: "1.5rem" }}>{error}</div>}

      {/* Interactive Map */}
      <div className="seats-map-container">
        <div className="map-header">
          <div className="map-title">
            {SECTION_NAMES[selectedSection]} Layout
            <span style={{ fontSize: "0.9rem", color: "var(--text-muted)", fontWeight: "500", marginLeft: "0.75rem" }}>
              ({slots.length - getOccupiedCount()} of {slots.length} Free)
            </span>
          </div>
          <div className="legend">
            <div className="legend-item">
              <div className="legend-dot available"></div> Available
            </div>
            <div className="legend-item">
              <div className="legend-dot occupied"></div> Occupied
            </div>
            <div className="legend-item">
              <div className="legend-dot selected"></div> Selected
            </div>
            <div className="legend-item">
              <div className="legend-dot locked"></div> Locked
            </div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "4rem 0", color: "var(--text-muted)", fontSize: "1.2rem" }}>
            Visualizing floor plan...
          </div>
        ) : (
          <div className="seat-grid">
            {slots.map((slot) => {
              const isSelected = selectedSlot === slot.slot_number;
              let seatClass = "seat ";
              if (slot.status === "occupied") {
                seatClass += "occupied";
              } else if (slot.status === "locked") {
                seatClass += "locked";
              } else if (isSelected) {
                seatClass += "selected";
              } else {
                seatClass += "available";
              }

              return (
                <div
                  key={slot.id}
                  className={seatClass}
                  onClick={() => handleSeatClick(slot)}
                  title={
                    slot.status === "occupied"
                      ? "Seat Occupied"
                      : slot.status === "locked"
                      ? "Seat Locked by Admin"
                      : `Seat #${slot.slot_number}`
                  }
                >
                  {slot.slot_number}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Button Footer */}
      <div style={{ marginTop: "2.5rem", display: "flex", gap: "1.5rem" }}>
        <button
          onClick={handleConfirmReservation}
          disabled={!selectedSlot || bookingLoading}
          className="btn-primary"
          style={{ flex: 2 }}
        >
          {bookingLoading
            ? "Reserving..."
            : selectedSlot
            ? `Confirm Reservation for Seat #${selectedSlot}`
            : "Select a Seat to Confirm"}
        </button>
        <button
          onClick={() => router.push("/")}
          className="btn-secondary"
          style={{ flex: 1 }}
        >
          Back
        </button>
      </div>
    </div>
  );
}

export default function SeatSelector() {
  return (
    <Suspense fallback={<div className="glass-card" style={{ textAlign: "center", padding: "4rem" }}>Loading portal...</div>}>
      <SeatSelectorContent />
    </Suspense>
  );
}
