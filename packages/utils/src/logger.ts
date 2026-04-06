export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export const createLogger = (name: string): Logger => {
  const format = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    const ts = new Date().toISOString();
    const base = `[${ts}] [${level.toUpperCase()}] [${name}] ${message}`;
    return meta ? `${base} ${JSON.stringify(meta)}` : base;
  };

  return {
    info: (msg, meta) => console.log(format('info', msg, meta)),
    warn: (msg, meta) => console.warn(format('warn', msg, meta)),
    error: (msg, meta) => console.error(format('error', msg, meta)),
    debug: (msg, meta) => console.debug(format('debug', msg, meta)),
  };
};
