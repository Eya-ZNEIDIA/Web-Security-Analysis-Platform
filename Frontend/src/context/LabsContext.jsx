import { createContext, useContext, useRef, useState } from "react";

// ─── Context ──────────────────────────────────────────────────────────────────
const LabsContext = createContext(null);

// ─── Default metrics shape ────────────────────────────────────────────────────
const defaultMetrics = {
  dnsMs: null,
  tcpMs: null,
  tlsMs: null,
  ttfbMs: null,
  totalMs: null,
  statusCode: null,
  ip: null,
  tls: null,
  server: null,
  bytes: null,
};

// ─── Provider ─────────────────────────────────────────────────────────────────
export function LabsProvider({ children }) {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState("idle"); // "idle" | "scanning" | "done"
  const [currentStep, setCurrentStep] = useState(0);
  const [results, setResults] = useState(null);
  const [metrics, setMetrics] = useState(defaultMetrics);

  const timersRef = useRef([]);

  // ── helpers ──
  const resetMetrics = () => setMetrics(defaultMetrics);

  const clearTimers = () => {
    timersRef.current.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    timersRef.current = [];
  };

  const reset = () => {
    clearTimers();
    setStatus("idle");
    setUrl("");
    setCurrentStep(0);
    setResults(null);
    resetMetrics();
  };

  return (
    <LabsContext.Provider
      value={{
        // state
        url,
        setUrl,
        status,
        setStatus,
        currentStep,
        setCurrentStep,
        results,
        setResults,
        metrics,
        setMetrics,
        // refs & helpers
        timersRef,
        resetMetrics,
        clearTimers,
        reset,
      }}
    >
      {children}
    </LabsContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLabs() {
  const ctx = useContext(LabsContext);
  if (!ctx) throw new Error("useLabs must be used inside <LabsProvider>");
  return ctx;
}
