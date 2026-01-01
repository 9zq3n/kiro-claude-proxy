/**
 * Model API for Kiro/AWS CodeWhisperer
 *
 * Provides model listing and usage limit APIs.
 */

import {
    KIRO_ENDPOINTS,
    KIRO_DEFAULT_REGION,
    KIRO_MODEL_MAPPING
} from '../constants.js';
import { getKiroAuthData } from '../auth/kiro-token-extractor.js';
import { buildKiroHeaders } from './request-builder.js';
import { logger } from '../utils/logger.js';

/**
 * List available models from Kiro
 * Returns models in Anthropic format for API compatibility
 * 
 * @returns {Promise<Object>} Anthropic-format models list
 */
export async function listKiroModels() {
    // Kiro's available models based on the SDK and docs
    // These are the Claude models available through AWS CodeWhisperer
    const models = [
        {
            id: 'claude-opus-4-5',
            created: Date.now(),
            object: 'model',
            owned_by: 'anthropic',
            description: 'Claude Opus 4.5 - Most capable Claude model',
            kiro_id: 'claude-opus-4.5'
        },
        {
            id: 'claude-sonnet-4-5',
            created: Date.now(),
            object: 'model',
            owned_by: 'anthropic',
            description: 'Claude Sonnet 4.5 - Balanced performance and speed',
            kiro_id: 'claude-sonnet-4.5'
        },
        {
            id: 'claude-sonnet-4',
            created: Date.now(),
            object: 'model',
            owned_by: 'anthropic',
            description: 'Claude Sonnet 4 - Fast and efficient',
            kiro_id: 'claude-sonnet-4'
        },
        {
            id: 'claude-haiku-4-5',
            created: Date.now(),
            object: 'model',
            owned_by: 'anthropic',
            description: 'Claude Haiku 4.5 - Fastest Claude model',
            kiro_id: 'claude-haiku-4.5'
        },
        {
            id: 'auto',
            created: Date.now(),
            object: 'model',
            owned_by: 'amazon',
            description: 'Auto - Let Kiro choose the best model',
            kiro_id: 'auto'
        }
    ];
    
    // Add thinking variants
    const thinkingModels = [
        {
            id: 'claude-opus-4-5-thinking',
            created: Date.now(),
            object: 'model',
            owned_by: 'anthropic',
            description: 'Claude Opus 4.5 with extended thinking',
            kiro_id: 'claude-opus-4.5'
        },
        {
            id: 'claude-sonnet-4-5-thinking',
            created: Date.now(),
            object: 'model',
            owned_by: 'anthropic',
            description: 'Claude Sonnet 4.5 with extended thinking',
            kiro_id: 'claude-sonnet-4.5'
        },
        {
            id: 'claude-sonnet-4-thinking',
            created: Date.now(),
            object: 'model',
            owned_by: 'anthropic',
            description: 'Claude Sonnet 4 with extended thinking',
            kiro_id: 'claude-sonnet-4'
        }
    ];
    
    return {
        object: 'list',
        data: [...models, ...thinkingModels]
    };
}

/**
 * Get usage limits from Kiro
 * Note: This requires the CodeWhispererRuntimeClient, not streaming
 * 
 * @returns {Promise<Object>} Usage limits data
 */
export async function getKiroUsageLimits() {
    try {
        const authData = await getKiroAuthData();
        const token = authData.accessToken;
        const region = authData.region || KIRO_DEFAULT_REGION;
        
        if (!token) {
            return {
                error: 'Not authenticated',
                limits: null
            };
        }
        
        // The usage limits API is on the runtime client, not streaming
        // For now, return placeholder limits
        // TODO: Implement actual usage limits API call if needed
        
        logger.debug('[Kiro] Usage limits not yet implemented');
        
        return {
            limits: {
                dailyLimit: 'unlimited',
                monthlyLimit: 'unlimited',
                used: 0,
                remaining: 'unlimited'
            },
            quotaResetTime: null
        };
        
    } catch (error) {
        logger.warn(`[Kiro] Failed to get usage limits: ${error.message}`);
        return {
            error: error.message,
            limits: null
        };
    }
}

/**
 * Get detailed model information
 * @param {string} modelId - The model ID to look up
 * @returns {Promise<Object|null>} Model details or null if not found
 */
export async function getKiroModelInfo(modelId) {
    const { data: models } = await listKiroModels();
    return models.find(m => m.id === modelId || m.kiro_id === modelId) || null;
}

/**
 * Check if a model is available in Kiro
 * @param {string} modelId - The model ID to check
 * @returns {Promise<boolean>} True if model is available
 */
export async function isKiroModelAvailable(modelId) {
    const model = await getKiroModelInfo(modelId);
    return model !== null;
}

export default {
    listKiroModels,
    getKiroUsageLimits,
    getKiroModelInfo,
    isKiroModelAvailable
};
