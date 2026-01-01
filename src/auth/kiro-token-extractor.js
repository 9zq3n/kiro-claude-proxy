/**
 * Kiro Token Extractor Module
 * Extracts OAuth tokens from Kiro CLI's SQLite database
 *
 * Kiro uses AWS OIDC authentication and stores tokens in:
 * - macOS: ~/Library/Application Support/kiro-cli/data.sqlite3
 * - Windows: ~/AppData/Roaming/kiro-cli/data.sqlite3
 * - Linux: ~/.config/kiro-cli/data.sqlite3
 */

import Database from 'better-sqlite3';
import { KIRO_DB_PATH, TOKEN_REFRESH_INTERVAL_MS } from '../constants.js';
import { logger } from '../utils/logger.js';

// Cache for the extracted token
let cachedToken = null;
let cachedRefreshToken = null;
let tokenExtractedAt = null;
let tokenExpiresAt = null;

/**
 * Get the Kiro database path based on the current platform.
 */
export function getKiroDbPath() {
    const home = process.env.HOME || process.env.USERPROFILE;
    const platform = process.platform;
    
    switch (platform) {
        case 'darwin':
            return `${home}/Library/Application Support/kiro-cli/data.sqlite3`;
        case 'win32':
            return `${home}/AppData/Roaming/kiro-cli/data.sqlite3`;
        default: // linux, freebsd, etc.
            return `${home}/.config/kiro-cli/data.sqlite3`;
    }
}

/**
 * Query Kiro database for authentication tokens
 * @param {string} [dbPath] - Optional custom database path
 * @returns {Object} Parsed auth data with access_token, refresh_token, etc.
 * @throws {Error} If database doesn't exist, query fails, or no auth found
 */
export function getKiroAuthStatus(dbPath = KIRO_DB_PATH) {
    let db;
    try {
        // Open database in read-only mode
        db = new Database(dbPath, {
            readonly: true,
            fileMustExist: true
        });

        // Query for token data
        const stmt = db.prepare(
            "SELECT value FROM auth_kv WHERE key = 'kirocli:odic:token'"
        );
        const row = stmt.get();

        if (!row || !row.value) {
            throw new Error('No auth token found in Kiro database');
        }

        // Parse the pipe-separated value (key|json_value format)
        let tokenData;
        const value = row.value;
        
        // The value is stored as "key|json" format, we need just the JSON part
        if (value.includes('|')) {
            const jsonPart = value.substring(value.indexOf('|') + 1);
            tokenData = JSON.parse(jsonPart);
        } else {
            tokenData = JSON.parse(value);
        }

        if (!tokenData.access_token) {
            throw new Error('Auth data missing access_token field');
        }

        return {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_at ? new Date(tokenData.expires_at) : null,
            region: tokenData.region || 'us-east-1',
            startUrl: tokenData.start_url,
            scopes: tokenData.scopes || []
        };
    } catch (error) {
        // Enhance error messages for common issues
        if (error.code === 'SQLITE_CANTOPEN') {
            throw new Error(
                `Kiro database not found at ${dbPath}. ` +
                'Make sure Kiro CLI is installed and you are logged in.'
            );
        }
        if (error.message.includes('No auth token') || error.message.includes('missing access_token')) {
            throw error;
        }
        throw new Error(`Failed to read Kiro database: ${error.message}`);
    } finally {
        if (db) {
            db.close();
        }
    }
}

/**
 * Get device registration info (client credentials)
 * @param {string} [dbPath] - Optional custom database path
 * @returns {Object} Device registration data
 */
export function getKiroDeviceRegistration(dbPath = KIRO_DB_PATH) {
    let db;
    try {
        db = new Database(dbPath, {
            readonly: true,
            fileMustExist: true
        });

        const stmt = db.prepare(
            "SELECT value FROM auth_kv WHERE key = 'kirocli:odic:device-registration'"
        );
        const row = stmt.get();

        if (!row || !row.value) {
            return null;
        }

        const value = row.value;
        if (value.includes('|')) {
            const jsonPart = value.substring(value.indexOf('|') + 1);
            return JSON.parse(jsonPart);
        }
        return JSON.parse(value);
    } catch (error) {
        logger.warn(`[Kiro] Failed to get device registration: ${error.message}`);
        return null;
    } finally {
        if (db) {
            db.close();
        }
    }
}

/**
 * Check if the cached token needs refresh
 */
function needsRefresh() {
    if (!cachedToken || !tokenExtractedAt) {
        return true;
    }
    
    // If we know the expiration time, check against it
    if (tokenExpiresAt) {
        // Refresh 5 minutes before expiration
        const bufferMs = 5 * 60 * 1000;
        if (new Date() >= new Date(tokenExpiresAt.getTime() - bufferMs)) {
            return true;
        }
    }
    
    // Otherwise use the standard refresh interval
    return Date.now() - tokenExtractedAt > TOKEN_REFRESH_INTERVAL_MS;
}

/**
 * Get the current OAuth token (with caching)
 * @returns {Promise<string>} The access token
 */
export async function getKiroToken() {
    if (needsRefresh()) {
        const data = getKiroAuthStatus();
        cachedToken = data.accessToken;
        cachedRefreshToken = data.refreshToken;
        tokenExpiresAt = data.expiresAt;
        tokenExtractedAt = Date.now();
        
        logger.info('[Kiro] Got fresh token from database');
    }
    
    return cachedToken;
}

/**
 * Get all Kiro auth data (token + metadata)
 * @returns {Promise<Object>} Full auth data
 */
export async function getKiroAuthData() {
    const data = getKiroAuthStatus();
    cachedToken = data.accessToken;
    cachedRefreshToken = data.refreshToken;
    tokenExpiresAt = data.expiresAt;
    tokenExtractedAt = Date.now();
    
    return data;
}

/**
 * Check if Kiro database exists and is accessible
 * @param {string} [dbPath] - Optional custom database path
 * @returns {boolean} True if database exists and can be opened
 */
export function isKiroDatabaseAccessible(dbPath = KIRO_DB_PATH) {
    let db;
    try {
        db = new Database(dbPath, {
            readonly: true,
            fileMustExist: true
        });
        return true;
    } catch {
        return false;
    } finally {
        if (db) {
            db.close();
        }
    }
}

/**
 * Check if Kiro is authenticated (has valid token)
 * @returns {boolean} True if authenticated
 */
export function isKiroAuthenticated() {
    try {
        const data = getKiroAuthStatus();
        
        // Check if token is expired
        if (data.expiresAt && new Date() >= data.expiresAt) {
            logger.warn('[Kiro] Token is expired');
            return false;
        }
        
        return !!data.accessToken;
    } catch {
        return false;
    }
}

/**
 * Clear the token cache (for testing or forced refresh)
 */
export function clearKiroTokenCache() {
    cachedToken = null;
    cachedRefreshToken = null;
    tokenExtractedAt = null;
    tokenExpiresAt = null;
}

export default {
    getKiroToken,
    getKiroAuthData,
    getKiroAuthStatus,
    getKiroDeviceRegistration,
    isKiroDatabaseAccessible,
    isKiroAuthenticated,
    clearKiroTokenCache,
    getKiroDbPath
};
