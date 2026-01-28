// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * TipTap Reassembler
 *
 * Reassembles AI-processed text back into a TipTap document structure.
 * This is the third step of the text-nodes-only pipeline:
 *
 * 1. EXTRACT: Extract text chunks with position information
 * 2. PROCESS: Send extracted text to AI for modification
 * 3. REASSEMBLE: This file - put AI response back into original structure
 * 4. VALIDATE: Ensure document structure was not corrupted
 *
 * Key principle: Only text content changes. Document structure, code blocks,
 * images, mentions, and other special content remain exactly as they were.
 */

import {cloneDocument} from './tiptap_text_extractor';
import type {
    TipTapDoc,
    TipTapNode,
    TipTapMark,
    TextChunk,
    PreservedMark,
    ReassemblyResult,
    ProtectedUrl,
} from './types';

/**
 * Reassembles AI-processed text back into a TipTap document.
 *
 * @param originalDoc - The original TipTap document
 * @param chunks - The original extracted chunks (with path information)
 * @param aiTexts - The AI-processed text for each chunk (same order as chunks)
 * @returns ReassemblyResult with the modified document
 */
export function reassembleDocument(
    originalDoc: TipTapDoc,
    chunks: TextChunk[],
    aiTexts: string[],
): ReassemblyResult {
    const warnings: string[] = [];

    if (chunks.length !== aiTexts.length) {
        return {
            doc: originalDoc,
            chunksProcessed: 0,
            success: false,
            warnings: [`Chunk count mismatch: ${chunks.length} chunks but ${aiTexts.length} AI responses`],
        };
    }

    // Create a deep clone to modify
    const newDoc = cloneDocument(originalDoc);
    let chunksProcessed = 0;

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const aiText = aiTexts[i];

        try {
            // Navigate to the node at the chunk's path
            const node = getNodeAtPath(newDoc, chunk.path);

            if (!node) {
                warnings.push(`Could not find node at path [${chunk.path.join(', ')}]`);
                continue;
            }

            // Rebuild the node's content with AI text
            node.content = rebuildNodeContent(aiText, chunk);
            chunksProcessed++;
        } catch (error) {
            warnings.push(`Error processing chunk ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    return {
        doc: newDoc,
        chunksProcessed,
        success: chunksProcessed === chunks.length,
        warnings,
    };
}

/**
 * Gets a node at a specific path in the document.
 *
 * @param doc - The document to navigate
 * @param path - Array of indices to follow
 * @returns The node at the path, or null if not found
 */
function getNodeAtPath(doc: TipTapDoc, path: number[]): TipTapNode | null {
    let current: TipTapNode = doc;

    for (const index of path) {
        if (!current.content || index >= current.content.length) {
            return null;
        }
        current = current.content[index];
    }

    return current;
}

/**
 * Restores protected URLs from placeholders in AI-processed text.
 * Uses split/join to replace all occurrences (handles AI duplication).
 *
 * @param text - The AI-processed text with placeholders
 * @param protectedUrls - The URL mappings from extraction
 * @returns Text with URLs restored
 */
function restoreProtectedUrls(text: string, protectedUrls?: ProtectedUrl[]): string {
    if (!protectedUrls?.length) {
        return text;
    }

    let result = text;
    for (const {placeholder, original} of protectedUrls) {
        // Use split/join for ES5 compatibility (replaces all occurrences)
        result = result.split(placeholder).join(original);
    }
    return result;
}

/**
 * Rebuilds a node's content array from AI-processed text.
 * Preserves marks and hard breaks from the original chunk.
 *
 * @param aiText - The AI-processed text
 * @param chunk - The original chunk with mark and hard break information
 * @returns Array of TipTap nodes for the content
 */
function rebuildNodeContent(aiText: string, chunk: TextChunk): TipTapNode[] {
    const content: TipTapNode[] = [];

    // If the AI text is empty, return empty content
    if (!aiText) {
        return content;
    }

    // Restore protected URLs first
    const restoredText = restoreProtectedUrls(aiText, chunk.protectedUrls);

    // Adjust mark positions if text length changed
    const adjustedMarks = adjustMarkPositions(chunk.marks, chunk.text.length, restoredText.length);

    // Split text by hard break positions and create nodes
    const segments = splitByHardBreaks(restoredText, chunk.hardBreakPositions);

    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];

        if (segment.length > 0) {
            // Apply marks to this segment
            const textNodes = applyMarksToText(segment, adjustedMarks, getSegmentOffset(segments, i));
            content.push(...textNodes);
        }

        // Add hard break after each segment except the last
        if (i < segments.length - 1) {
            content.push({type: 'hardBreak'});
        }
    }

    return content;
}

/**
 * Splits text by hard break positions.
 *
 * @param text - The text to split
 * @param hardBreakPositions - Positions where hard breaks should occur
 * @returns Array of text segments
 */
function splitByHardBreaks(text: string, hardBreakPositions: number[]): string[] {
    if (hardBreakPositions.length === 0) {
        return [text];
    }

    const segments: string[] = [];
    let lastPos = 0;

    // Sort positions to ensure correct order
    const sortedPositions = [...hardBreakPositions].sort((a, b) => a - b);

    for (const pos of sortedPositions) {
        // Clamp position to text length
        const clampedPos = Math.min(pos, text.length);
        if (clampedPos > lastPos) {
            segments.push(text.slice(lastPos, clampedPos));
        } else {
            segments.push('');
        }

        // Skip the newline character that was inserted during extraction
        lastPos = clampedPos + 1;
    }

    // Add remaining text after last hard break
    if (lastPos < text.length) {
        segments.push(text.slice(lastPos));
    } else if (lastPos === text.length) {
        segments.push('');
    }

    return segments;
}

/**
 * Gets the character offset for a segment.
 *
 * @param segments - All segments
 * @param segmentIndex - Index of the current segment
 * @returns Character offset from the start of the text
 */
function getSegmentOffset(segments: string[], segmentIndex: number): number {
    let offset = 0;
    for (let i = 0; i < segmentIndex; i++) {
        offset += segments[i].length + 1; // +1 for the hard break
    }
    return offset;
}

/**
 * Applies marks to text, creating multiple text nodes as needed.
 *
 * @param text - The text to apply marks to
 * @param marks - The marks to apply
 * @param offset - Character offset of this text in the original chunk
 * @returns Array of text nodes with appropriate marks
 */
function applyMarksToText(text: string, marks: PreservedMark[], offset: number): TipTapNode[] {
    if (marks.length === 0) {
        return [{type: 'text', text}];
    }

    // Find mark boundaries within this text segment
    const boundaries = new Set<number>([0, text.length]);

    for (const mark of marks) {
        const relativeFrom = mark.from - offset;
        const relativeTo = mark.to - offset;

        // Only add boundaries that are within this text segment
        if (relativeFrom > 0 && relativeFrom < text.length) {
            boundaries.add(relativeFrom);
        }
        if (relativeTo > 0 && relativeTo < text.length) {
            boundaries.add(relativeTo);
        }
    }

    // Sort boundaries
    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

    // Create text nodes for each segment between boundaries
    const nodes: TipTapNode[] = [];

    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
        const start = sortedBoundaries[i];
        const end = sortedBoundaries[i + 1];
        const segmentText = text.slice(start, end);

        if (!segmentText) {
            continue;
        }

        // Find marks that apply to this segment
        const absoluteStart = offset + start;
        const absoluteEnd = offset + end;
        const applicableMarks = marks.filter(
            (mark) => mark.from < absoluteEnd && mark.to > absoluteStart,
        );

        if (applicableMarks.length === 0) {
            nodes.push({type: 'text', text: segmentText});
        } else {
            nodes.push({
                type: 'text',
                text: segmentText,
                marks: applicableMarks.map(preservedMarkToTipTapMark),
            });
        }
    }

    return nodes;
}

/**
 * Converts a PreservedMark to a TipTap mark.
 *
 * @param mark - The preserved mark
 * @returns TipTap mark object
 */
function preservedMarkToTipTapMark(mark: PreservedMark): TipTapMark {
    const tipTapMark: TipTapMark = {type: mark.type};
    if (mark.attrs) {
        tipTapMark.attrs = mark.attrs;
    }
    return tipTapMark;
}

/**
 * Adjusts mark positions based on text length changes.
 * Used when AI response has different length than original.
 *
 * @param marks - Original marks
 * @param originalLength - Original text length
 * @param newLength - New text length
 * @returns Adjusted marks
 */
export function adjustMarkPositions(
    marks: PreservedMark[],
    originalLength: number,
    newLength: number,
): PreservedMark[] {
    // Guard against invalid lengths (zero, negative, or unchanged)
    if (originalLength <= 0 || newLength < 0 || originalLength === newLength) {
        return marks;
    }

    const ratio = newLength / originalLength;

    return marks.map((mark) => ({
        ...mark,
        from: Math.round(mark.from * ratio),
        to: Math.round(mark.to * ratio),
    }));
}
