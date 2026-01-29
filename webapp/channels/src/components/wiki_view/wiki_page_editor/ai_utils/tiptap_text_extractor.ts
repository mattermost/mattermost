// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * TipTap Text Extractor
 *
 * Extracts text from TipTap documents for AI processing while preserving
 * document structure. This is the first step of the text-nodes-only pipeline:
 *
 * 1. EXTRACT: This file - extracts text chunks with position information
 * 2. PROCESS: Send extracted text to AI for modification
 * 3. REASSEMBLE: Put AI response back into original document structure
 * 4. VALIDATE: Ensure document structure was not corrupted
 *
 * Key principle: AI only sees and modifies text content. Code blocks,
 * images, mentions, and other special content are preserved unchanged.
 */

import type {
    TipTapDoc,
    TipTapNode,
    TextChunk,
    PreservedMark,
    ExtractionResult,
    ProtectedUrl,
} from './types';
import {
    isExcludedNodeType,
    isTextContainerNodeType,
    isStructuralNodeType,
} from './types';

/**
 * Extracts text chunks from a TipTap document.
 *
 * @param doc - The TipTap document to extract text from
 * @returns ExtractionResult with text chunks and metadata
 */
export function extractTextChunks(doc: TipTapDoc): ExtractionResult {
    const chunks: TextChunk[] = [];
    const skippedNodeTypes = new Set<string>();
    let skippedNodeCount = 0;

    function traverse(node: TipTapNode, path: number[]): void {
        // Skip excluded node types entirely (don't descend into children)
        if (isExcludedNodeType(node.type)) {
            skippedNodeCount++;
            skippedNodeTypes.add(node.type);
            return;
        }

        // Extract text from text container nodes
        if (isTextContainerNodeType(node.type)) {
            const chunk = extractChunkFromNode(node, path);
            if (chunk.text.length > 0) {
                chunks.push(chunk);
            }
            return;
        }

        // Recurse into structural nodes
        if (isStructuralNodeType(node.type) || node.type === 'doc') {
            if (node.content) {
                node.content.forEach((child, index) => {
                    traverse(child, [...path, index]);
                });
            }
            return;
        }

        // Unknown node type - skip but log
        skippedNodeCount++;
        skippedNodeTypes.add(node.type);
    }

    traverse(doc, []);

    const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);

    return {
        chunks,
        totalCharacters,
        skippedNodeCount,
        skippedNodeTypes: Array.from(skippedNodeTypes),
    };
}

/**
 * Protects URLs that appear as link text from AI modification.
 * Uses existing mark positions - no document-wide regex scanning needed.
 * Also adjusts mark positions to account for the length difference between
 * original URLs and their placeholders.
 *
 * @param text - The extracted text
 * @param marks - The preserved marks with positions
 * @returns Protected text with placeholders, URL mappings, and adjusted marks
 */
function protectLinkUrls(
    text: string,
    marks: PreservedMark[],
): { protectedText: string; protectedUrls: ProtectedUrl[]; adjustedMarks: PreservedMark[] } {
    // Find link marks where visible text is a URL (case-insensitive)
    const urlMarks = marks.
        filter((m) => m.type === 'link').
        filter((m) => (/^https?:\/\//i).test(text.slice(m.from, m.to)));

    if (urlMarks.length === 0) {
        return {protectedText: text, protectedUrls: [], adjustedMarks: marks};
    }

    // Sort by position ascending to assign placeholder numbers in document order
    const urlMarksSortedAsc = [...urlMarks].sort((a, b) => a.from - b.from);

    // Pre-assign placeholder numbers based on document order
    const placeholderMap = new Map<PreservedMark, { placeholder: string; original: string }>();
    for (let i = 0; i < urlMarksSortedAsc.length; i++) {
        const mark = urlMarksSortedAsc[i];
        const original = text.slice(mark.from, mark.to);
        const placeholder = `⟦URL:${i}⟧`;
        placeholderMap.set(mark, {placeholder, original});
    }

    // Process from end to beginning to preserve earlier positions
    const urlMarksSortedDesc = [...urlMarks].sort((a, b) => b.from - a.from);

    // Clone marks so we can adjust positions
    let adjustedMarks = marks.map((m) => ({...m}));

    let result = text;
    for (const mark of urlMarksSortedDesc) {
        const {placeholder, original} = placeholderMap.get(mark)!;

        result = result.slice(0, mark.from) + placeholder + result.slice(mark.to);

        // Calculate the length difference
        const lengthDiff = placeholder.length - original.length;

        // Adjust mark positions to account for the replacement
        adjustedMarks = adjustedMarks.map((m) => {
            const adjusted = {...m};

            if (m.from >= mark.to) {
                // Mark starts after the replaced URL - shift both positions
                adjusted.from += lengthDiff;
                adjusted.to += lengthDiff;
            } else if (m.from === mark.from && m.to === mark.to) {
                // This is the URL link mark itself - adjust end to match placeholder
                adjusted.to = m.from + placeholder.length;
            } else if (m.from < mark.from && m.to > mark.to) {
                // Mark spans across the URL - adjust the end position
                adjusted.to += lengthDiff;
            } else if (m.to > mark.from && m.to <= mark.to) {
                // Mark ends within or at the URL - clamp to URL start
                adjusted.to = Math.min(adjusted.to, mark.from + placeholder.length);
            }

            return adjusted;
        });
    }

    // Build protectedUrls array in document order
    const protectedUrls: ProtectedUrl[] = urlMarksSortedAsc.map((mark) => placeholderMap.get(mark)!);

    return {protectedText: result, protectedUrls, adjustedMarks};
}

/**
 * Extracts a text chunk from a text container node (paragraph, heading, etc.)
 *
 * @param node - The text container node
 * @param path - The JSON path to this node
 * @returns TextChunk with extracted text and mark positions
 */
function extractChunkFromNode(node: TipTapNode, path: number[]): TextChunk {
    let text = '';
    const marks: PreservedMark[] = [];
    const hardBreakPositions: number[] = [];

    if (!node.content) {
        return {
            path,
            nodeType: node.type,
            text: '',
            marks: [],
            hardBreakPositions: [],
            nodeAttrs: node.attrs,
        };
    }

    for (const child of node.content) {
        if (child.type === 'text' && child.text) {
            const startPos = text.length;
            text += child.text;

            // Record marks with their positions
            if (child.marks) {
                for (const mark of child.marks) {
                    // Skip mention marks - we don't want AI to modify mention text
                    if (mark.type === 'mention' || mark.type === 'channelMention') {
                        continue;
                    }

                    marks.push({
                        type: mark.type,
                        attrs: mark.attrs ? {...mark.attrs} : undefined,
                        from: startPos,
                        to: text.length,
                    });
                }
            }
        } else if (child.type === 'hardBreak') {
            hardBreakPositions.push(text.length);
            text += '\n';
        }

        // Skip other inline nodes (mentions rendered as nodes, etc.)
        // They are preserved in the original document
    }

    // Consolidate marks and protect URLs that appear as link text
    const consolidatedMarks = consolidateMarks(marks);
    const {protectedText, protectedUrls, adjustedMarks} = protectLinkUrls(text, consolidatedMarks);

    return {
        path,
        nodeType: node.type,
        text: protectedText,
        marks: adjustedMarks,
        hardBreakPositions,
        nodeAttrs: node.attrs,
        protectedUrls: protectedUrls.length > 0 ? protectedUrls : undefined,
    };
}

/**
 * Consolidates overlapping marks of the same type.
 * For example, if we have bold from 0-5 and bold from 3-8, merge to 0-8.
 *
 * @param marks - Array of marks to consolidate
 * @returns Consolidated marks array
 */
function consolidateMarks(marks: PreservedMark[]): PreservedMark[] {
    if (marks.length === 0) {
        return [];
    }

    // Group marks by type
    const marksByType = new Map<string, PreservedMark[]>();
    for (const mark of marks) {
        const key = `${mark.type}:${JSON.stringify(mark.attrs || {})}`;
        if (!marksByType.has(key)) {
            marksByType.set(key, []);
        }
        marksByType.get(key)!.push(mark);
    }

    // Consolidate each group
    const result: PreservedMark[] = [];
    for (const [, groupMarks] of marksByType) {
        // Sort by start position
        groupMarks.sort((a, b) => a.from - b.from);

        // Merge overlapping ranges
        let current = {...groupMarks[0]};
        for (let i = 1; i < groupMarks.length; i++) {
            const next = groupMarks[i];
            if (next.from <= current.to) {
                // Overlapping or adjacent - extend current
                current.to = Math.max(current.to, next.to);
            } else {
                // Gap - push current and start new
                result.push(current);
                current = {...next};
            }
        }
        result.push(current);
    }

    return result;
}

/**
 * Combines extracted text chunks into a single string for AI processing.
 * Uses a separator that's unlikely to appear in normal text.
 *
 * @param chunks - Array of text chunks
 * @param separator - Separator between chunks (default: double newline)
 * @returns Combined text string
 */
export function combineChunksForAI(chunks: TextChunk[], separator = '\n\n'): string {
    return chunks.map((chunk) => chunk.text).join(separator);
}

/**
 * Splits AI response back into individual chunk texts.
 * Must use the same separator that was used in combineChunksForAI.
 *
 * @param aiResponse - The AI's response text
 * @param separator - Separator used when combining (default: double newline)
 * @returns Array of text strings, one per original chunk
 */
export function splitAIResponse(aiResponse: string, separator = '\n\n'): string[] {
    return aiResponse.split(separator);
}

/**
 * Estimates token count for text (rough approximation).
 * Uses ~4 characters per token as a conservative estimate.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/**
 * Batches chunks to fit within token limits.
 * Each batch can be sent to AI separately.
 *
 * @param chunks - All extracted chunks
 * @param maxTokensPerBatch - Maximum tokens per batch (default: 2000)
 * @returns Array of chunk batches
 */
export function batchChunks(chunks: TextChunk[], maxTokensPerBatch = 2000): TextChunk[][] {
    const batches: TextChunk[][] = [];
    let currentBatch: TextChunk[] = [];
    let currentTokens = 0;

    for (const chunk of chunks) {
        const chunkTokens = estimateTokens(chunk.text);

        // If single chunk exceeds limit, put it in its own batch
        if (chunkTokens > maxTokensPerBatch) {
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
                currentBatch = [];
                currentTokens = 0;
            }
            batches.push([chunk]);
            continue;
        }

        // If adding this chunk would exceed limit, start new batch
        if (currentTokens + chunkTokens > maxTokensPerBatch && currentBatch.length > 0) {
            batches.push(currentBatch);
            currentBatch = [];
            currentTokens = 0;
        }

        currentBatch.push(chunk);
        currentTokens += chunkTokens;
    }

    // Don't forget the last batch
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }

    return batches;
}

/**
 * Creates a deep clone of a TipTap document.
 * Used to preserve the original before modifications.
 *
 * @param doc - Document to clone
 * @returns Deep clone of the document
 */
export function cloneDocument(doc: TipTapDoc): TipTapDoc {
    return JSON.parse(JSON.stringify(doc));
}
