// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * AI Utilities for TipTap Editor
 *
 * This module provides the text-nodes-only pipeline for AI processing
 * of wiki page content. The pipeline ensures that AI only modifies text
 * while preserving document structure, code blocks, images, and other
 * protected content.
 *
 * Usage:
 * ```typescript
 * import {
 *     extractTextChunks,
 *     reassembleDocument,
 *     validateDocument,
 * } from './ai_utils';
 *
 * // 1. Extract text from document
 * const {chunks} = extractTextChunks(doc);
 *
 * // 2. Combine for AI processing
 * const textForAI = combineChunksForAI(chunks);
 *
 * // 3. Send to AI and get response
 * const aiResponse = await callAI(textForAI);
 *
 * // 4. Split response back into chunks
 * const aiTexts = splitAIResponse(aiResponse);
 *
 * // 5. Reassemble into document
 * const {doc: newDoc} = reassembleDocument(originalDoc, chunks, aiTexts);
 *
 * // 6. Validate the result
 * const validation = validateDocument(originalDoc, newDoc);
 * if (!validation.valid) {
 *     // Handle validation errors
 * }
 * ```
 */

// Types
export type {
    TipTapDoc,
    TipTapNode,
    TipTapMark,
    TipTapNodeAttrs,
    TextChunk,
    PreservedMark,
    ExtractionResult,
    ReassemblyResult,
    ValidationResult,
    ExcludedNodeType,
    TextContainerNodeType,
    StructuralNodeType,
    PreservedMarkType,
} from './types';

export {
    EXCLUDED_NODE_TYPES,
    TEXT_CONTAINER_NODE_TYPES,
    STRUCTURAL_NODE_TYPES,
    PRESERVED_MARK_TYPES,
    isExcludedNodeType,
    isTextContainerNodeType,
    isStructuralNodeType,
} from './types';

// Extraction
export {
    extractTextChunks,
    combineChunksForAI,
    splitAIResponse,
    estimateTokens,
    batchChunks,
    cloneDocument,
} from './tiptap_text_extractor';

// Reassembly
export {
    reassembleDocument,
    adjustMarkPositions,
} from './tiptap_reassembler';

// Validation
export {
    validateDocument,
    validateAIResponse,
    countNodeTypes,
    quickSanityCheck,
} from './content_validator';
