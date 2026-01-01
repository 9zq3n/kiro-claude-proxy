/**
 * Logger Utility
 * 
 * Provides structured logging with colors and debug support.
 * Simple ANSI codes used to avoid dependencies.
 */

const COLORS = {
    RESET: '\x1b[0m',
    BRIGHT: '\x1b[1m',
    DIM: '\x1b[2m',
    
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    MAGENTA: '\x1b[35m',
    CYAN: '\x1b[36m',
    WHITE: '\x1b[37m',
    GRAY: '\x1b[90m'
};

class Logger {
    constructor() {
        this.isDebugEnabled = false;
    }

    /**
     * Set debug mode
     * @param {boolean} enabled 
     */
    setDebug(enabled) {
        this.isDebugEnabled = !!enabled;
    }

    /**
     * Get current timestamp string
     */
    getTimestamp() {
        return new Date().toISOString();
    }

    /**
     * Format and print a log message
     * @param {string} level 
     * @param {string} color 
     * @param {string} message 
     * @param  {...any} args 
     */
    print(level, color, message, ...args) {
        // Format: [TIMESTAMP] [LEVEL] Message
        const timestamp = `${COLORS.GRAY}[${this.getTimestamp()}]${COLORS.RESET}`;
        const levelTag = `${color}[${level}]${COLORS.RESET}`;
        
        console.log(`${timestamp} ${levelTag} ${message}`, ...args);
    }

    /**
     * Standard info log
     */
    info(message, ...args) {
        this.print('INFO', COLORS.BLUE, message, ...args);
    }

    /**
     * Success log
     */
    success(message, ...args) {
        this.print('SUCCESS', COLORS.GREEN, message, ...args);
    }

    /**
     * Warning log
     */
    warn(message, ...args) {
        this.print('WARN', COLORS.YELLOW, message, ...args);
    }

    /**
     * Error log
     */
    error(message, ...args) {
        this.print('ERROR', COLORS.RED, message, ...args);
    }

    /**
     * Debug log - only prints if debug mode is enabled
     */
    debug(message, ...args) {
        if (this.isDebugEnabled) {
            this.print('DEBUG', COLORS.MAGENTA, message, ...args);
        }
    }

    /**
     * Direct log (for raw output usually) - proxied to console.log but can be enhanced
     */
    log(message, ...args) {
        console.log(message, ...args);
    }
    
    /**
     * Print a section header
     */
    header(title) {
        console.log(`\n${COLORS.BRIGHT}${COLORS.CYAN}=== ${title} ===${COLORS.RESET}\n`);
    }
}

// Export a singleton instance
export const logger = new Logger();

// Export class if needed for multiple instances
export { Logger };
