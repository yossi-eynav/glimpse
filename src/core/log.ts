export type LogLevel = 'info' | 'warn' | 'error';
export type Log = (level: LogLevel, message: string, fields?: Record<string, unknown>) => void;

const SECRET_KEYS = new Set(['access_token', 'refresh_token', 'id_token', 'code', 'client_secret', 'authorization']);

/** Replaces credential-bearing fields at any depth, so logs never carry tokens (FR-027). */
export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, SECRET_KEYS.has(k.toLowerCase()) ? '[redacted]' : redact(v)]),
  );
}

export const consoleLog: Log = (level, message, fields) => {
  const args = fields ? [message, redact(fields)] : [message];
  if (level === 'error') console.error(...args);
  else if (level === 'warn') console.warn(...args);
  else console.info(...args);
};
