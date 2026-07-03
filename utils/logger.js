// ============================================================
//  LOGGER — Winston
// ============================================================
const fs   = require('fs');
const path = require('path');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize, errors } = format;

// Hakikisha folder ya logs/ ipo kabla ya kuandika faili (huepuka crash
// kwenye mazingira kama Render bila Docker, ambako folder haijaundwa)
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    new transports.Console({
      format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), logFormat)
    }),
    new transports.File({ filename: path.join(logsDir, 'error.log'),    level: 'error' }),
    new transports.File({ filename: path.join(logsDir, 'combined.log') }),
  ],
});

module.exports = logger;
