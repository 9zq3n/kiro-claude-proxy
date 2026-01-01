/**
 * Kiro Claude Proxy
 * Entry point - starts the proxy server
 */

import app from './server.js';
import { DEFAULT_PORT } from './constants.js';
import { logger } from './utils/logger.js';

// Parse command line arguments
const args = process.argv.slice(2);
const isDebug = args.includes('--debug') || process.env.DEBUG === 'true';

// Initialize logger
logger.setDebug(isDebug);

if (isDebug) {
    logger.debug('Debug mode enabled');
}

const PORT = process.env.PORT || DEFAULT_PORT;

app.listen(PORT, () => {
    // Clear console for a clean start
    console.clear();

    logger.log(`
╔══════════════════════════════════════════════════════════════╗
║                 Kiro Claude Proxy Server                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Server running at: http://localhost:${PORT}                 ║
║                                                              ║
║  Control:                                                    ║
║    --debug            Enable debug logging                   ║
║    Ctrl+C             Stop server                            ║
║                                                              ║
║  Endpoints:                                                  ║
║    POST /v1/messages  - Anthropic Messages API               ║
║    GET  /v1/models    - List available models                ║
║    GET  /health       - Health check                         ║
║                                                              ║
║  Usage with Claude Code:                                     ║
║    export ANTHROPIC_BASE_URL=http://localhost:${PORT}        ║
║    export ANTHROPIC_API_KEY=dummy                            ║
║    claude                                                    ║
║                                                              ║
║  Prerequisites:                                              ║
║    - Kiro CLI must be installed and authenticated            ║
║    - Run "kiro auth" to authenticate                         ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
  `);
    
    logger.success(`Server started successfully on port ${PORT}`);
    if (isDebug) {
        logger.warn('Running in DEBUG mode - verbose logs enabled');
    }
});
