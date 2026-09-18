// Adziga — Structured logger
// Production-grade logging with level, context, and (future) sink dispatch.

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  ctx?: Record<string, any>;
}

const COLORS = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
  reset: "\x1b[0m"
};

function fmt(entry: LogEntry): string {
  const c = COLORS[entry.level];
  const ctx = entry.ctx ? ` ${JSON.stringify(entry.ctx)}` : "";
  return `${c}[${entry.ts}] [${entry.level.toUpperCase()}] ${entry.msg}${ctx}${COLORS.reset}`;
}

export const logger = {
  debug(msg: string, ctx?: Record<string, any>) {
    if (process.env.LOG_LEVEL === "debug") {
      console.debug(fmt({ ts: new Date().toISOString(), level: "debug", msg, ctx }));
    }
  },
  info(msg: string, ctx?: Record<string, any>) {
    console.log(fmt({ ts: new Date().toISOString(), level: "info", msg, ctx }));
  },
  warn(msg: string, ctx?: Record<string, any>) {
    console.warn(fmt({ ts: new Date().toISOString(), level: "warn", msg, ctx }));
  },
  error(msg: string, ctx?: Record<string, any>) {
    console.error(fmt({ ts: new Date().toISOString(), level: "error", msg, ctx }));
  }
};