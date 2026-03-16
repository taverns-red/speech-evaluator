// Metrics Collector — in-memory performance counters for /api/metrics
// Phase 7 Sprint 1 (#118)
//
// Singleton-style factory. Tracks sessions, evaluations, errors, API calls,
// and evaluation latency percentiles. No external dependencies.

const MAX_LATENCY_SAMPLES = 1000;

export interface MetricsSnapshot {
  uptimeSeconds: number;
  sessionsTotal: number;
  evaluationsTotal: number;
  transcriptionErrorsTotal: number;
  ttsErrorsTotal: number;
  apiCallsByProvider: Record<string, number>;
  evaluationLatencyP50: number | null;
  evaluationLatencyP90: number | null;
  evaluationLatencyP99: number | null;
}

export interface MetricsCollector {
  incrementSessions(): void;
  incrementEvaluations(): void;
  incrementTranscriptionErrors(): void;
  incrementTTSErrors(): void;
  incrementApiCalls(provider: string): void;
  recordEvaluationLatency(ms: number): void;
  snapshot(): MetricsSnapshot;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

export function createMetricsCollector(): MetricsCollector {
  const bootTime = Date.now();
  let sessionsTotal = 0;
  let evaluationsTotal = 0;
  let transcriptionErrorsTotal = 0;
  let ttsErrorsTotal = 0;
  const apiCallsByProvider: Record<string, number> = {};
  const latencies: number[] = [];

  return {
    incrementSessions() {
      sessionsTotal++;
    },

    incrementEvaluations() {
      evaluationsTotal++;
    },

    incrementTranscriptionErrors() {
      transcriptionErrorsTotal++;
    },

    incrementTTSErrors() {
      ttsErrorsTotal++;
    },

    incrementApiCalls(provider: string) {
      apiCallsByProvider[provider] = (apiCallsByProvider[provider] ?? 0) + 1;
    },

    recordEvaluationLatency(ms: number) {
      latencies.push(ms);
      // Cap to prevent unbounded memory growth
      if (latencies.length > MAX_LATENCY_SAMPLES) {
        latencies.splice(0, latencies.length - MAX_LATENCY_SAMPLES);
      }
    },

    snapshot(): MetricsSnapshot {
      let p50: number | null = null;
      let p90: number | null = null;
      let p99: number | null = null;

      if (latencies.length > 0) {
        const sorted = [...latencies].sort((a, b) => a - b);
        p50 = percentile(sorted, 50);
        p90 = percentile(sorted, 90);
        p99 = percentile(sorted, 99);
      }

      return {
        uptimeSeconds: Math.floor((Date.now() - bootTime) / 1000),
        sessionsTotal,
        evaluationsTotal,
        transcriptionErrorsTotal,
        ttsErrorsTotal,
        apiCallsByProvider: { ...apiCallsByProvider },
        evaluationLatencyP50: p50,
        evaluationLatencyP90: p90,
        evaluationLatencyP99: p99,
      };
    },
  };
}
