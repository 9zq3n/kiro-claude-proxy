/**
 * Kiro Client for AWS CodeWhisperer
 *
 * Communicates with AWS CodeWhisperer API using Kiro's authentication tokens.
 * Provides Claude model access through AWS's infrastructure.
 *
 * This module mirrors the cloudcode module but uses AWS APIs instead of Google.
 */

// Re-export public API
export { sendKiroMessage } from './message-handler.js';
export { sendKiroMessageStream } from './streaming-handler.js';
export { listKiroModels, getKiroUsageLimits, getKiroModelInfo, isKiroModelAvailable } from './model-api.js';
export { mapModelToKiro, buildKiroRequest, buildKiroHeaders } from './request-builder.js';
export { convertKiroToAnthropic, convertStreamingResponse } from './response-converter.js';

// Default export for backwards compatibility
import { sendKiroMessage } from './message-handler.js';
import { sendKiroMessageStream } from './streaming-handler.js';
import { listKiroModels, getKiroUsageLimits } from './model-api.js';

export default {
    sendMessage: sendKiroMessage,
    sendMessageStream: sendKiroMessageStream,
    listModels: listKiroModels,
    getUsageLimits: getKiroUsageLimits
};
