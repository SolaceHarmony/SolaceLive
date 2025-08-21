/**
 * Backend logging utility for Node.js server
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

const LogLevelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'];

class ServerLogger {
  constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.logs = [];
    this.maxLogs = 10000;
    this.logFile = path.join(__dirname, '..', 'logs', `server_${new Date().toISOString().split('T')[0]}.log`);
    
    // Create logs directory if it doesn't exist
    const logsDir = path.dirname(this.logFile);
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Setup process error handlers
    this.setupErrorHandlers();
  }
  
  setupErrorHandlers() {
    // Uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.fatal('process', 'Uncaught Exception', { 
        message: error.message,
        stack: error.stack 
      }, error);
      // Give time to write logs before exit
      setTimeout(() => process.exit(1), 1000);
    });
    
    // Unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.error('process', 'Unhandled Promise Rejection', { 
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise)
      }, reason instanceof Error ? reason : new Error(String(reason)));
    });
    
    // Process warnings
    process.on('warning', (warning) => {
      this.warn('process', 'Node.js Warning', {
        name: warning.name,
        message: warning.message,
        stack: warning.stack
      });
    });
  }
  
  log(level, component, message, data, error) {
    if (level < this.logLevel) return;
    
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level: LogLevelNames[level],
      component,
      message,
      data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined
    };
    
    // Store in memory
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Format for console
    const consoleMsg = `[${timestamp}] [${LogLevelNames[level]}] [${component}] ${message}`;
    
    // Console output with color
    if (level === LogLevel.DEBUG) {
      console.log('\x1b[36m%s\x1b[0m', consoleMsg, data || '');
    } else if (level === LogLevel.INFO) {
      console.log('\x1b[32m%s\x1b[0m', consoleMsg, data || '');
    } else if (level === LogLevel.WARN) {
      console.warn('\x1b[33m%s\x1b[0m', consoleMsg, data || '');
    } else if (level >= LogLevel.ERROR) {
      console.error('\x1b[31m%s\x1b[0m', consoleMsg, data || '', error?.stack || '');
    }
    
    // Write to file
    this.writeToFile(entry);
  }
  
  writeToFile(entry) {
    try {
      const line = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.logFile, line);
    } catch (err) {
      // Silently fail - don't create infinite loop
      console.error('Failed to write to log file:', err.message);
    }
  }
  
  debug(component, message, data) {
    this.log(LogLevel.DEBUG, component, message, data);
  }
  
  info(component, message, data) {
    this.log(LogLevel.INFO, component, message, data);
  }
  
  warn(component, message, data) {
    this.log(LogLevel.WARN, component, message, data);
  }
  
  error(component, message, data, error) {
    this.log(LogLevel.ERROR, component, message, data, error);
  }
  
  fatal(component, message, data, error) {
    this.log(LogLevel.FATAL, component, message, data, error);
  }
  
  // Express middleware for request logging
  requestLogger() {
    return (req, res, next) => {
      const start = Date.now();
      const { method, url, headers } = req;
      
      // Log request
      this.info('http', `${method} ${url}`, {
        ip: req.ip,
        userAgent: headers['user-agent']
      });
      
      // Override res.end to log response
      const originalEnd = res.end;
      res.end = (...args) => {
        res.end = originalEnd;
        const duration = Date.now() - start;
        
        // Log response
        this.info('http', `${method} ${url} - ${res.statusCode}`, {
          duration: `${duration}ms`,
          statusCode: res.statusCode
        });
        
        // Log errors
        if (res.statusCode >= 400) {
          this.warn('http', `Error response: ${method} ${url}`, {
            statusCode: res.statusCode,
            duration: `${duration}ms`
          });
        }
        
        return res.end(...args);
      };
      
      next();
    };
  }
  
  // Express error handler middleware
  errorHandler() {
    return (err, req, res, next) => {
      const { method, url } = req;
      
      this.error('http', `Error handling ${method} ${url}`, {
        message: err.message,
        statusCode: err.statusCode || 500
      }, err);
      
      // Send error response if not already sent
      if (!res.headersSent) {
        res.status(err.statusCode || 500).json({
          error: err.message || 'Internal server error',
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        });
      }
    };
  }
  
  // Get recent logs
  getLogs(level = LogLevel.INFO, limit = 100) {
    return this.logs
      .filter(log => LogLevelNames.indexOf(log.level) >= level)
      .slice(-limit);
  }
  
  // Clear logs
  clearLogs() {
    this.logs = [];
  }
}

// Export singleton
export const logger = new ServerLogger();

// Convenience exports
export const logDebug = (component, message, data) => logger.debug(component, message, data);
export const logInfo = (component, message, data) => logger.info(component, message, data);
export const logWarn = (component, message, data) => logger.warn(component, message, data);
export const logError = (component, message, data, error) => logger.error(component, message, data, error);
export const logFatal = (component, message, data, error) => logger.fatal(component, message, data, error);

// Async wrapper with logging
export async function withLogging(component, operation, fn) {
  const start = Date.now();
  logger.debug(component, `${operation} started`);
  
  try {
    const result = await fn();
    const duration = Date.now() - start;
    logger.info(component, `${operation} completed`, { duration: `${duration}ms` });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error(component, `${operation} failed`, { duration: `${duration}ms` }, error);
    throw error;
  }
}

export default logger;