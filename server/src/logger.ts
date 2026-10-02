type Level = 'info' | 'warn' | 'error';

// One JSON object per line keeps Render's log search usable. Never pass secrets or request bodies here.
function write(level: Level, message: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...fields });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logger = {
  info: (message: string, fields?: Record<string, unknown>) => write('info', message, fields),
  warn: (message: string, fields?: Record<string, unknown>) => write('warn', message, fields),
  error: (message: string, error?: unknown, fields?: Record<string, unknown>) =>
    write('error', message, {
      ...fields,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    })
};
