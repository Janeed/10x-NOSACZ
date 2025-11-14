type LogLevel = 'debug' | 'info' | 'warn' | 'error';

type LogPayload = {
  event: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
};

const write = ({ level, message, event, context }: LogPayload): void => {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    message,
    ...(context ? { context } : {}),
  };

  switch (level) {
    case 'debug':
      console.debug(entry);
      break;
    case 'info':
      console.info(entry);
      break;
    case 'warn':
      console.warn(entry);
      break;
    case 'error':
      console.error(entry);
      break;
  }
};

const log = (level: LogLevel, event: string, message: string, context?: Record<string, unknown>): void => {
  write({ level, event, message, context });
};

export const logger = {
  debug: (event: string, message: string, context?: Record<string, unknown>) => log('debug', event, message, context),
  info: (event: string, message: string, context?: Record<string, unknown>) => log('info', event, message, context),
  warn: (event: string, message: string, context?: Record<string, unknown>) => log('warn', event, message, context),
  error: (event: string, message: string, context?: Record<string, unknown>) => log('error', event, message, context),
};
