/**
 * Constants for Kiro Claude Proxy
 * Kiro-specific configuration and AWS CodeWhisperer integration
 */

import { homedir, platform, arch } from 'os';
import { join } from 'path';

/**
 * Get the Kiro CLI database path based on the current platform.
 * Kiro stores OAuth tokens in SQLite database similar to VS Code extensions.
 */
function getKiroDbPath() {
    const home = homedir();
    switch (platform()) {
        case 'darwin':
            return join(home, 'Library/Application Support/kiro-cli/data.sqlite3');
        case 'win32':
            return join(home, 'AppData/Roaming/kiro-cli/data.sqlite3');
        default: // linux, freebsd, etc.
            return join(home, '.config/kiro-cli/data.sqlite3');
    }
}

// Basic configuration
export const REQUEST_BODY_LIMIT = '50mb';
export const DEFAULT_PORT = 8080;
export const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
export const MAX_RETRIES = 3; // Max retry attempts

// Kiro CLI database path for token extraction
export const KIRO_DB_PATH = getKiroDbPath();

// AWS CodeWhisperer API endpoint pattern
export const KIRO_ENDPOINT_TEMPLATE = 'https://codewhisperer.{region}.amazonaws.com';

// AWS CodeWhisperer API endpoints by region
export const KIRO_ENDPOINTS = {
    'us-east-1': 'https://codewhisperer.us-east-1.amazonaws.com',
    'us-west-2': 'https://codewhisperer.us-west-2.amazonaws.com',
    'eu-west-1': 'https://codewhisperer.eu-west-1.amazonaws.com',
    'ap-northeast-1': 'https://codewhisperer.ap-northeast-1.amazonaws.com'
};

// Kiro API paths
export const KIRO_API_PATHS = {
    GENERATE_ASSISTANT: '/generateAssistantResponse',  // Main chat endpoint
    SEND_MESSAGE: '/SendMessageStreaming',             // Alternative chat endpoint
    MCP: '/mcp',                                       // MCP invocation
    EXPORT_ARCHIVE: '/exportResultArchive',            // Export results
    TASK_PLAN: '/generateTaskAssistPlan'               // Task planning
};

// Default AWS region for Kiro
export const KIRO_DEFAULT_REGION = 'us-east-1';

// Kiro model mappings (Claude model names to Kiro's internal model IDs)
export const KIRO_MODEL_MAPPING = {
    // Claude models - map Anthropic names to Kiro internal IDs
    'claude-sonnet-4-5': 'claude-sonnet-4.5',
    'claude-sonnet-4-5-thinking': 'claude-sonnet-4.5',
    'claude-sonnet-4': 'claude-sonnet-4',
    'claude-sonnet-4-thinking': 'claude-sonnet-4',
    'claude-haiku-4-5': 'claude-haiku-4.5',
    'claude-opus-4-5': 'claude-opus-4.5',
    'claude-opus-4-5-thinking': 'claude-opus-4.5',
    // Auto model
    'auto': 'auto'
};

// Kiro-specific headers for AWS CodeWhisperer Streaming Service
export const KIRO_HEADERS = {
    'User-Agent': 'kiro-proxy/1.0.0',
    'Content-Type': 'application/json'
};

// AWS service name for signing requests
export const KIRO_AWS_SERVICE = 'amazoncodewhispererstreamingservice';

// Kiro API service names (client types)
export const KIRO_SERVICE = {
    RUNTIME: 'CodeWhispererRuntimeClient',
    STREAMING: 'CodeWhispererStreamingClient'
};

// Kiro origin identifiers (for request source)
export const KIRO_ORIGIN = {
    KIRO_CLI: 'KIRO_CLI',
    IDE: 'IDE',
    AI_EDITOR: 'AI_EDITOR'
};

// Chat trigger types
export const KIRO_CHAT_TRIGGER = {
    MANUAL: 'MANUAL',
    DIAGNOSTIC: 'DIAGNOSTIC',
    INLINE_CHAT: 'INLINE_CHAT'
};

// Kiro configuration file path
export const KIRO_CONFIG_PATH = join(
    homedir(),
    '.config/kiro-proxy/config.json'
);

/**
 * Check if a model supports thinking/reasoning output.
 * @param {string} modelName - The model name from the request
 * @returns {boolean} True if the model supports thinking blocks
 */
export function isThinkingModel(modelName) {
    const lower = (modelName || '').toLowerCase();
    // Claude thinking models have "thinking" in the name
    if (lower.includes('claude') && lower.includes('thinking')) return true;
    return false;
}

export default {
    REQUEST_BODY_LIMIT,
    DEFAULT_PORT,
    KIRO_DB_PATH,
    KIRO_ENDPOINT_TEMPLATE,
    KIRO_ENDPOINTS,
    KIRO_API_PATHS,
    KIRO_DEFAULT_REGION,
    KIRO_MODEL_MAPPING,
    KIRO_HEADERS,
    KIRO_AWS_SERVICE,
    KIRO_SERVICE,
    KIRO_ORIGIN,
    KIRO_CHAT_TRIGGER,
    KIRO_CONFIG_PATH,
    isThinkingModel
};
