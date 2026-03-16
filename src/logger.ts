// Structured JSON logger for Cloud Run / Cloud Logging
// Phase 7 Sprint 1 (#118)
//
// Zero external dependencies. Outputs JSON lines to stdout.
// Cloud Logging automatically parses the "severity" field for filtering.

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Cloud Logging severity names (not the same as our enum names)
const SEVERITY_NAMES: Record<LogLevel, string> = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO",
  [LogLevel.WARN]: "WARNING", // Cloud Logging uses "WARNING", not "WARN"
  [LogLevel.ERROR]: "ERROR",
};

let globalLogLevel: LogLevel = LogLevel.INFO;

export function setGlobalLogLevel(level: LogLevel): void {
  globalLogLevel = level;
}

export function getGlobalLogLevel(): LogLevel {
  return globalLogLevel;
}

/**
 * Parse LOG_LEVEL env var into a LogLevel enum value.
 * Called once at module load time.
 */
function parseEnvLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toUpperCase();
  switch (envLevel) {
    case "DEBUG": return LogLevel.DEBUG;
    case "INFO": return LogLevel.INFO;
    case "WARN":
    case "WARNING": return LogLevel.WARN;
    case "ERROR": return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
}

// Set global level from env on module load
globalLogLevel = parseEnvLogLevel();

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(defaultMeta: Record<string, unknown>): Logger;
}

function writeLog(
  level: LogLevel,
  component: string,
  message: string,
  defaultMeta: Record<string, unknown>,
  meta?: Record<string, unknown>,
): void {
  if (level < globalLogLevel) return;

  const entry: Record<string, unknown> = {
    severity: SEVERITY_NAMES[level],
    timestamp: new Date().toISOString(),
    component,
    message,
    ...defaultMeta,
  };

  // Merge per-call metadata
  if (meta) {
    for (const [key, value] of Object.entries(meta)) {
      if (key === "error" && value instanceof Error) {
        entry.error = value.message;
        entry.errorName = value.name;
        entry.stack = value.stack;
      } else {
        entry[key] = value;
      }
    }
  }

  process.stdout.write(JSON.stringify(entry) + "\n");
}

/**
 * Create a structured logger for a component.
 *
 * @param component — identifies the source module (e.g., "SessionManager", "Server")
 * @returns Logger with debug/info/warn/error methods
 */
export function createLogger(component: string, defaultMeta: Record<string, unknown> = {}): Logger {
  return {
    debug: (message, meta) => writeLog(LogLevel.DEBUG, component, message, defaultMeta, meta),
    info: (message, meta) => writeLog(LogLevel.INFO, component, message, defaultMeta, meta),
    warn: (message, meta) => writeLog(LogLevel.WARN, component, message, defaultMeta, meta),
    error: (message, meta) => writeLog(LogLevel.ERROR, component, message, defaultMeta, meta),
    child: (childMeta) => createLogger(component, { ...defaultMeta, ...childMeta }),
  };
}
