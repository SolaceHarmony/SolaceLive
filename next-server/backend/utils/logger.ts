/**
 * Centralized logging utility with proper error handling
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  data?: any;
  error?: Error;
  stack?: string;
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel = LogLevel.INFO;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private isProduction = import.meta.env.PROD;
  
  private constructor() {
    // Set log level based on environment
    this.logLevel = this.isProduction ? LogLevel.WARN : LogLevel.DEBUG;
    
    // Override console methods to capture all logs
    this.interceptConsole();
    
    // Listen for unhandled errors
    this.setupGlobalErrorHandlers();
  }
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private interceptConsole() {
    const originalConsole = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
    
    console.log = (...args) => {
      this.log(LogLevel.INFO, 'console', args.join(' '));
      originalConsole.log(...args);
    };
    
    console.info = (...args) => {
      this.log(LogLevel.INFO, 'console', args.join(' '));
      originalConsole.info(...args);
    };
    
    console.warn = (...args) => {
      this.log(LogLevel.WARN, 'console', args.join(' '));
      originalConsole.warn(...args);
    };
    
    console.error = (...args) => {
      const error = args[0] instanceof Error ? args[0] : new Error(args.join(' '));
      this.log(LogLevel.ERROR, 'console', error.message, undefined, error);
      originalConsole.error(...args);
    };
    
    console.debug = (...args) => {
      this.log(LogLevel.DEBUG, 'console', args.join(' '));
      originalConsole.debug(...args);
    };
  }
  
  private setupGlobalErrorHandlers() {
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.fatal('window', 'Unhandled Promise Rejection', {
        reason: event.reason,
        promise: event.promise
      }, event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
    });
    
    // Global errors
    window.addEventListener('error', (event) => {
      this.fatal('window', 'Uncaught Error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      }, event.error);
    });
  }
  
  private log(
    level: LogLevel,
    component: string,
    message: string,
    data?: any,
    error?: Error
  ) {
    if (level < this.logLevel) return;
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data,
      error,
      stack: error?.stack
    };
    
    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
    
    // Send to backend in production
    if (this.isProduction && level >= LogLevel.ERROR) {
      this.sendToBackend(entry);
    }
    
    // Store critical errors in localStorage
    if (level >= LogLevel.ERROR) {
      this.storeError(entry);
    }
  }
  
  private async sendToBackend(entry: LogEntry) {
    try {
      await fetch('http://localhost:8787/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (err) {
      // Silently fail - don't create infinite loop
    }
  }
  
  private storeError(entry: LogEntry) {
    try {
      const errors = JSON.parse(localStorage.getItem('app_errors') || '[]');
      errors.push({
        ...entry,
        data: JSON.stringify(entry.data),
        error: entry.error ? {
          message: entry.error.message,
          stack: entry.error.stack
        } : undefined
      });
      
      // Keep only last 50 errors
      if (errors.length > 50) {
        errors.splice(0, errors.length - 50);
      }
      
      localStorage.setItem('app_errors', JSON.stringify(errors));
    } catch (err) {
      // Ignore storage errors
    }
  }
  
  // Public logging methods
  debug(component: string, message: string, data?: any) {
    this.log(LogLevel.DEBUG, component, message, data);
  }
  
  info(component: string, message: string, data?: any) {
    this.log(LogLevel.INFO, component, message, data);
  }
  
  warn(component: string, message: string, data?: any) {
    this.log(LogLevel.WARN, component, message, data);
  }
  
  error(component: string, message: string, data?: any, error?: Error) {
    this.log(LogLevel.ERROR, component, message, data, error);
  }
  
  fatal(component: string, message: string, data?: any, error?: Error) {
    this.log(LogLevel.FATAL, component, message, data, error);
  }
  
  // Get logs for debugging
  getLogs(level?: LogLevel): LogEntry[] {
    if (level === undefined) return [...this.logs];
    return this.logs.filter(log => log.level >= level);
  }
  
  // Clear logs
  clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem('app_errors');
    } catch {}
  }
  
  // Export logs
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }
  
  // Download logs as file
  downloadLogs() {
    const blob = new Blob([this.exportLogs()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  
  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Convenience functions
export const logDebug = (component: string, message: string, data?: any) => 
  logger.debug(component, message, data);

export const logInfo = (component: string, message: string, data?: any) => 
  logger.info(component, message, data);

export const logWarn = (component: string, message: string, data?: any) => 
  logger.warn(component, message, data);

export const logError = (component: string, message: string, data?: any, error?: Error) => 
  logger.error(component, message, data, error);

export const logFatal = (component: string, message: string, data?: any, error?: Error) => 
  logger.fatal(component, message, data, error);

// Performance logging
export function logPerformance(component: string, operation: string, startTime: number) {
  const duration = performance.now() - startTime;
  logger.info(component, `${operation} completed`, { duration: `${duration.toFixed(2)}ms` });
}

// Async operation wrapper with logging
export async function withLogging<T>(
  component: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = performance.now();
  logger.debug(component, `${operation} started`);
  
  try {
    const result = await fn();
    logPerformance(component, operation, startTime);
    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error(component, `${operation} failed`, { duration: performance.now() - startTime }, err);
    throw error;
  }
}

// React component error boundary helper
export function logComponentError(componentName: string, error: Error, errorInfo: any) {
  logger.error('React', `Component error in ${componentName}`, {
    componentStack: errorInfo.componentStack,
    errorBoundary: componentName
  }, error);
}