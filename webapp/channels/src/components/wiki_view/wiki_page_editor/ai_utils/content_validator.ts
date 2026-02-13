// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * TipTap Content Validator
 *
 * Validates that AI processing didn't corrupt document structure.
 * This is the fourth step of the text-nodes-only pipeline:
 *
 * 1. EXTRACT: Extract text chunks with position information
 * 2. PROCESS: Send extracted text to AI for modification
 * 3. REASSEMBLE: Put AI response back into original structure
 * 4. VALIDATE: This file - ensure document structure was not corrupted
 *
 * Key validations:
 * - Node counts match (same number of paragraphs, headings, etc.)
 * - Excluded nodes are byte-identical (code blocks, images unchanged)
 * - No structural corruption (lists still have list items, etc.)
 */

import type {
    TipTapDoc,
    TipTapNode,
    ValidationResult,
} from './types';
import {EXCLUDED_NODE_TYPES} from './types';

/**
 * Validates that a modified document maintains structural integrity.
 *
 * @param original - The original document before AI processing
 * @param modified - The document after AI processing
 * @returns ValidationResult indicating if the document is valid
 */
export function validateDocument(original: TipTapDoc, modified: TipTapDoc): ValidationResult {
    const errors: string[] = [];

    // Count nodes by type in both documents
    const originalCounts = countNodeTypes(original);
    const modifiedCounts = countNodeTypes(modified);

    // Check that node counts match
    for (const [type, count] of Object.entries(originalCounts)) {
        const modifiedCount = modifiedCounts[type] || 0;
        if (modifiedCount !== count) {
            errors.push(`Node count mismatch for '${type}': original ${count}, modified ${modifiedCount}`);
        }
    }

    // Check for new node types that weren't in original
    for (const [type, count] of Object.entries(modifiedCounts)) {
        if (!(type in originalCounts) && count > 0) {
            errors.push(`New node type '${type}' appeared with count ${count}`);
        }
    }

    // Verify excluded nodes are unchanged
    const excludedErrors = verifyExcludedNodesUnchanged(original, modified);
    errors.push(...excludedErrors);

    return {
        valid: errors.length === 0,
        errors,
        nodeCounts: modifiedCounts,
    };
}

/**
 * Counts all node types in a document.
 *
 * @param doc - The document to count nodes in
 * @returns Record of node type to count
 */
export function countNodeTypes(doc: TipTapDoc): Record<string, number> {
    const counts: Record<string, number> = {};

    function traverse(node: TipTapNode): void {
        counts[node.type] = (counts[node.type] || 0) + 1;

        if (node.content) {
            for (const child of node.content) {
                traverse(child);
            }
        }
    }

    traverse(doc);
    return counts;
}

/**
 * Verifies that all excluded nodes (code blocks, images, etc.) are unchanged.
 *
 * @param original - Original document
 * @param modified - Modified document
 * @returns Array of error messages if any excluded nodes changed
 */
function verifyExcludedNodesUnchanged(original: TipTapDoc, modified: TipTapDoc): string[] {
    const errors: string[] = [];

    const originalExcluded = collectExcludedNodes(original);
    const modifiedExcluded = collectExcludedNodes(modified);

    if (originalExcluded.length !== modifiedExcluded.length) {
        errors.push(
            `Excluded node count changed: original ${originalExcluded.length}, modified ${modifiedExcluded.length}`,
        );
        return errors;
    }

    for (let i = 0; i < originalExcluded.length; i++) {
        const orig = originalExcluded[i];
        const mod = modifiedExcluded[i];

        if (!nodesAreIdentical(orig.node, mod.node)) {
            errors.push(
                `Excluded node at path [${orig.path.join(', ')}] (${orig.node.type}) was modified`,
            );
        }
    }

    return errors;
}

/**
 * Collects all excluded nodes with their paths.
 *
 * @param doc - Document to collect from
 * @returns Array of {node, path} objects
 */
function collectExcludedNodes(doc: TipTapDoc): Array<{node: TipTapNode; path: number[]}> {
    const excluded: Array<{node: TipTapNode; path: number[]}> = [];

    function traverse(node: TipTapNode, path: number[]): void {
        if ((EXCLUDED_NODE_TYPES as readonly string[]).includes(node.type)) {
            excluded.push({node, path});
            return; // Don't descend into excluded nodes
        }

        if (node.content) {
            node.content.forEach((child, index) => {
                traverse(child, [...path, index]);
            });
        }
    }

    traverse(doc, []);
    return excluded;
}

/**
 * Checks if two nodes are identical (deep equality).
 *
 * @param a - First node
 * @param b - Second node
 * @returns True if nodes are identical
 */
function nodesAreIdentical(a: TipTapNode, b: TipTapNode): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Validates AI response text to catch obvious AI misbehavior.
 * Rejects responses that dramatically change the structure.
 *
 * @param originalText - Original text that was sent to AI
 * @param aiText - AI's response
 * @param maxSentenceChangeDelta - Maximum allowed change in sentence count
 * @returns Object with valid flag and reason if invalid
 */
export function validateAIResponse(
    originalText: string,
    aiText: string,
    maxSentenceChangeDelta = 2,
): {valid: boolean; reason?: string} {
    // Handle empty strings - both empty is valid
    if (originalText.length === 0 && aiText.length === 0) {
        return {valid: true};
    }

    // Count sentences (rough approximation)
    const originalSentences = countSentences(originalText);
    const aiSentences = countSentences(aiText);

    if (Math.abs(originalSentences - aiSentences) > maxSentenceChangeDelta) {
        return {
            valid: false,
            reason: `Sentence count changed significantly: ${originalSentences} → ${aiSentences}`,
        };
    }

    // Check for suspicious patterns that indicate AI went off-script
    if (aiText.includes('```') && !originalText.includes('```')) {
        return {
            valid: false,
            reason: 'AI added code block that was not in original',
        };
    }

    // Check for dramatic length changes (more than 3x or less than 1/3)
    const lengthRatio = aiText.length / (originalText.length || 1);
    if (lengthRatio > 3 || lengthRatio < 0.33) {
        return {
            valid: false,
            reason: `Text length changed dramatically: ${originalText.length} → ${aiText.length} chars`,
        };
    }

    return {valid: true};
}

/**
 * Counts sentences in text (rough approximation).
 *
 * @param text - Text to count sentences in
 * @returns Approximate sentence count
 */
function countSentences(text: string): number {
    if (!text.trim()) {
        return 0;
    }

    // Split by sentence-ending punctuation
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    return sentences.length;
}

/**
 * Performs a quick sanity check on a document.
 * Catches obvious structural issues.
 *
 * @param doc - Document to check
 * @returns Object with valid flag and errors if any
 */
export function quickSanityCheck(doc: TipTapDoc): {valid: boolean; errors: string[]} {
    const errors: string[] = [];

    // Check root is a doc node
    if (doc.type !== 'doc') {
        errors.push(`Root node type is '${doc.type}', expected 'doc'`);
    }

    // Check doc has content array
    if (!doc.content || !Array.isArray(doc.content)) {
        errors.push('Document has no content array');
    }

    // Recursively check for obvious issues
    function checkNode(node: TipTapNode, path: string): void {
        if (!node.type) {
            errors.push(`Node at ${path} has no type`);
        }

        // Text nodes should have text
        if (node.type === 'text' && typeof node.text !== 'string') {
            errors.push(`Text node at ${path} has no text property`);
        }

        // Container nodes should have content array (or be empty)
        const containerTypes = ['doc', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote'];
        if (containerTypes.includes(node.type) && node.content !== undefined && !Array.isArray(node.content)) {
            errors.push(`Container node ${node.type} at ${path} has invalid content`);
        }

        // Recurse
        if (node.content) {
            node.content.forEach((child, index) => {
                checkNode(child, `${path}[${index}]`);
            });
        }
    }

    if (doc.content) {
        doc.content.forEach((child, index) => {
            checkNode(child, `doc.content[${index}]`);
        });
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}
