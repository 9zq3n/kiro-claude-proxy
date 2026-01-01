/**
 * AWS Event Stream Parser for Kiro/CodeWhisperer
 * 
 * Parses the AWS binary event stream format used by CodeWhisperer APIs.
 * Format: [total_length:4][headers_length:4][prelude_crc:4][headers:headers_length][payload][message_crc:4]
 */

/**
 * Parse a single AWS event stream message from a buffer
 * @param {ArrayBuffer} buffer - The buffer containing the event stream data
 * @param {number} offset - The offset to start reading from
 * @returns {Object|null} Parsed event with data and next offset, or null if incomplete
 */
function parseEventMessage(buffer, offset) {
    if (offset + 12 > buffer.byteLength) {
        return null; // Not enough data for prelude
    }
    
    const view = new DataView(buffer, offset);
    const totalLength = view.getUint32(0);
    const headersLength = view.getUint32(4);
    // const preludeCrc = view.getUint32(8); // CRC check skipped for simplicity
    
    if (offset + totalLength > buffer.byteLength) {
        return null; // Incomplete message
    }
    
    const payloadOffset = offset + 12 + headersLength;
    const payloadLength = totalLength - headersLength - 16; // 12 prelude + 4 message CRC
    
    if (payloadLength <= 0) {
        return { data: null, nextOffset: offset + totalLength };
    }
    
    const bytes = new Uint8Array(buffer, payloadOffset, payloadLength);
    const payload = new TextDecoder().decode(bytes);
    
    let data = null;
    try {
        data = JSON.parse(payload);
    } catch (e) {
        // Not JSON, return raw string
        data = { raw: payload };
    }
    
    return {
        data,
        nextOffset: offset + totalLength
    };
}

/**
 * Parse all events from an AWS event stream buffer
 * @param {ArrayBuffer} buffer - The buffer containing event stream data
 * @returns {Array<Object>} Array of parsed events
 */
export function parseEventStream(buffer) {
    const events = [];
    let offset = 0;
    
    while (offset < buffer.byteLength) {
        const result = parseEventMessage(buffer, offset);
        if (!result) break;
        
        if (result.data !== null) {
            events.push(result.data);
        }
        offset = result.nextOffset;
    }
    
    return events;
}

/**
 * Parse AWS event stream from a ReadableStream (for streaming responses)
 * @param {ReadableStream} stream - The readable stream from fetch response
 * @yields {Object} Parsed events as they arrive
 */
export async function* parseEventStreamAsync(stream) {
    const reader = stream.getReader();
    let buffer = new Uint8Array(0);
    
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Append new data to buffer
            const newBuffer = new Uint8Array(buffer.length + value.length);
            newBuffer.set(buffer);
            newBuffer.set(value, buffer.length);
            buffer = newBuffer;
            
            // Parse complete messages from buffer
            let offset = 0;
            while (offset < buffer.length) {
                if (offset + 12 > buffer.length) break;
                
                const view = new DataView(buffer.buffer, buffer.byteOffset + offset);
                const totalLength = view.getUint32(0);
                
                if (offset + totalLength > buffer.length) break;
                
                const headersLength = view.getUint32(4);
                const payloadOffset = offset + 12 + headersLength;
                const payloadLength = totalLength - headersLength - 16;
                
                if (payloadLength > 0) {
                    const payload = new TextDecoder().decode(
                        buffer.slice(payloadOffset, payloadOffset + payloadLength)
                    );
                    
                    try {
                        yield JSON.parse(payload);
                    } catch (e) {
                        yield { raw: payload };
                    }
                }
                
                offset += totalLength;
            }
            
            // Keep unprocessed data in buffer
            if (offset > 0) {
                buffer = buffer.slice(offset);
            }
        }
    } finally {
        reader.releaseLock();
    }
}

/**
 * Extract content from parsed events
 * @param {Array<Object>} events - Array of parsed events
 * @returns {Object} Extracted content with text, usage, etc.
 */
export function extractContentFromEvents(events) {
    let fullContent = '';
    let usage = { input_tokens: 0, output_tokens: 0 };
    let toolUses = [];
    
    for (const event of events) {
        // Content events
        if (event.content !== undefined) {
            fullContent += event.content;
        }
        
        // Usage/metering events
        if (event.unit === 'credit' || event.usage !== undefined) {
            usage.output_tokens = Math.round((event.usage || 0) * 1000); // Approximate
        }
        
        // Tool use events
        if (event.toolUse || event.toolUseEvent) {
            const toolUse = event.toolUse || event.toolUseEvent;
            toolUses.push({
                id: toolUse.toolUseId,
                name: toolUse.name,
                input: toolUse.input
            });
        }
    }
    
    return {
        content: fullContent,
        usage,
        toolUses
    };
}

export default {
    parseEventStream,
    parseEventStreamAsync,
    extractContentFromEvents
};
