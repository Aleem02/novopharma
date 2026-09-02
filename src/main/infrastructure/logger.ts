// Simple centralized logger
export enum LogLevel {
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export class Logger {
  static log(level: LogLevel, context: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      context,
      message,
      // Ensure we don't log raw error objects directly if they contain secrets,
      // but for V1 foundation we just stringify safely.
      data: data ? JSON.stringify(data) : undefined,
    };

    // In production, this would write to a secure file.
    // For V1 foundation, we just output to stdout.
    console.log(
      `[${logEntry.timestamp}] [${logEntry.level}] [${logEntry.context}] ${logEntry.message} ${logEntry.data || ""}`,
    );
  }

  static info(context: string, message: string, data?: any) {
    this.log(LogLevel.INFO, context, message, data);
  }

  static warn(context: string, message: string, data?: any) {
    this.log(LogLevel.WARN, context, message, data);
  }

  static error(context: string, message: string, data?: any) {
    this.log(LogLevel.ERROR, context, message, data);
  }
}
