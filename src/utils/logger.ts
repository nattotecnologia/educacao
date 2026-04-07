const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

type LogLevel = keyof typeof LOG_LEVELS;

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, any>;
  error?: string;
}

const currentLevel = (process.env.LOG_LEVEL || 'info') as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] <= LOG_LEVELS[currentLevel];
}

function formatLog(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.context) {
    return `${base} ${JSON.stringify(entry.context)}`;
  }
  return base;
}

export const logger = {
  error(message: string, context?: Record<string, any>, error?: Error) {
    if (!shouldLog('error')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
      error: error?.stack || error?.message,
    };
    
    console.error(formatLog(entry));
    
    if (process.env.NODE_ENV === 'production') {
      console.error(JSON.stringify(entry));
    }
  },

  warn(message: string, context?: Record<string, any>) {
    if (!shouldLog('warn')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
    };
    
    console.warn(formatLog(entry));
  },

  info(message: string, context?: Record<string, any>) {
    if (!shouldLog('info')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    };
    
    console.log(formatLog(entry));
  },

  debug(message: string, context?: Record<string, any>) {
    if (!shouldLog('debug')) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
    };
    
    console.log(formatLog(entry));
  },
};

export function createContextLogger(context: Record<string, any>) {
  return {
    error: (message: string, ctx?: Record<string, any>, error?: Error) => 
      logger.error(message, { ...context, ...ctx }, error),
    warn: (message: string, ctx?: Record<string, any>) => 
      logger.warn(message, { ...context, ...ctx }),
    info: (message: string, ctx?: Record<string, any>) => 
      logger.info(message, { ...context, ...ctx }),
    debug: (message: string, ctx?: Record<string, any>) => 
      logger.debug(message, { ...context, ...ctx }),
  };
}
