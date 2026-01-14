// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * Proofread Action
 *
 * Implements full-page proofreading using the text-nodes-only pipeline.
 * This ensures AI only modifies text while preserving document structure,
 * code blocks, images, and other protected content.
 *
 * Flow:
 * 1. Extract text chunks from TipTap document
 * 2. Send each chunk to AI for proofreading
 * 3. Reassemble corrected text into original document structure
 * 4. Validate the result
 */

import {Client4} from 'mattermost-redux/client';

import {RewriteAction} from 'components/advanced_text_editor/rewrite_action';

import type {TipTapDoc, ExtractionResult, ReassemblyResult} from '../ai_utils';
import {
    extractTextChunks,
    reassembleDocument,
    validateDocument,
    cloneDocument,
} from '../ai_utils';

export interface ProofreadResult {
    success: boolean;
    doc: TipTapDoc;
    chunksProcessed: number;
    totalChunks: number;
    errors: string[];
    warnings: string[];
}

export interface ProofreadProgress {
    current: number;
    total: number;
    status: 'extracting' | 'processing' | 'reassembling' | 'validating' | 'complete' | 'error';
}

/**
 * Proofreads an entire TipTap document by extracting text, sending to AI,
 * and reassembling the corrected text back into the original structure.
 *
 * @param doc - The TipTap document to proofread
 * @param agentId - The AI agent ID to use
 * @param onProgress - Optional callback for progress updates
 * @returns ProofreadResult with the corrected document
 */
export async function proofreadDocument(
    doc: TipTapDoc,
    agentId: string,
    onProgress?: (progress: ProofreadProgress) => void,
): Promise<ProofreadResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Step 1: Extract text chunks
    onProgress?.({current: 0, total: 0, status: 'extracting'});

    let extraction: ExtractionResult;
    try {
        extraction = extractTextChunks(doc);
    } catch (error) {
        return {
            success: false,
            doc,
            chunksProcessed: 0,
            totalChunks: 0,
            errors: [`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`],
            warnings,
        };
    }

    const {chunks} = extraction;

    if (chunks.length === 0) {
        return {
            success: true,
            doc,
            chunksProcessed: 0,
            totalChunks: 0,
            errors: [],
            warnings: ['No text content found to proofread'],
        };
    }

    // Step 2: Process each chunk with AI
    onProgress?.({current: 0, total: chunks.length, status: 'processing'});

    const correctedTexts: string[] = [];

    // Process chunks sequentially to enable progress reporting
    // eslint-disable-next-line no-await-in-loop
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        // Skip empty chunks
        if (!chunk.text.trim()) {
            correctedTexts.push(chunk.text);
            onProgress?.({current: i + 1, total: chunks.length, status: 'processing'});
            continue;
        }

        try {
            // eslint-disable-next-line no-await-in-loop
            const correctedText = await Client4.getAIRewrittenMessage(
                agentId,
                chunk.text,
                RewriteAction.FIX_SPELLING,
            );
            correctedTexts.push(correctedText);
        } catch (error) {
            // On error, keep original text and record warning
            warnings.push(`Failed to proofread chunk ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            correctedTexts.push(chunk.text);
        }

        onProgress?.({current: i + 1, total: chunks.length, status: 'processing'});
    }

    // Step 3: Reassemble document
    onProgress?.({current: chunks.length, total: chunks.length, status: 'reassembling'});

    let reassembly: ReassemblyResult;
    try {
        reassembly = reassembleDocument(doc, chunks, correctedTexts);
    } catch (error) {
        return {
            success: false,
            doc,
            chunksProcessed: 0,
            totalChunks: chunks.length,
            errors: [`Failed to reassemble document: ${error instanceof Error ? error.message : 'Unknown error'}`],
            warnings,
        };
    }

    warnings.push(...reassembly.warnings);

    if (!reassembly.success) {
        return {
            success: false,
            doc,
            chunksProcessed: reassembly.chunksProcessed,
            totalChunks: chunks.length,
            errors: ['Document reassembly failed'],
            warnings,
        };
    }

    // Step 4: Validate result
    onProgress?.({current: chunks.length, total: chunks.length, status: 'validating'});

    const validation = validateDocument(doc, reassembly.doc);
    if (!validation.valid) {
        errors.push(...validation.errors);
    }

    onProgress?.({current: chunks.length, total: chunks.length, status: 'complete'});

    return {
        success: errors.length === 0,
        doc: reassembly.doc,
        chunksProcessed: reassembly.chunksProcessed,
        totalChunks: chunks.length,
        errors,
        warnings,
    };
}

/**
 * Creates a preview of what will be proofread without actually calling the AI.
 * Useful for showing the user what content will be processed.
 *
 * @param doc - The TipTap document to analyze
 * @returns Information about extractable content
 */
export function previewProofread(doc: TipTapDoc): {
    textChunkCount: number;
    totalCharacters: number;
    skippedNodeTypes: string[];
    skippedNodeCount: number;
} {
    const extraction = extractTextChunks(doc);

    return {
        textChunkCount: extraction.chunks.length,
        totalCharacters: extraction.totalCharacters,
        skippedNodeTypes: extraction.skippedNodeTypes,
        skippedNodeCount: extraction.skippedNodeCount,
    };
}

/**
 * Proofreads a document and returns a cloned result, leaving the original unchanged.
 * This is useful for implementing undo functionality.
 *
 * @param doc - The original TipTap document
 * @param agentId - The AI agent ID to use
 * @param onProgress - Optional callback for progress updates
 * @returns ProofreadResult with a new document (original is unchanged)
 */
export async function proofreadDocumentImmutable(
    doc: TipTapDoc,
    agentId: string,
    onProgress?: (progress: ProofreadProgress) => void,
): Promise<ProofreadResult> {
    const clonedDoc = cloneDocument(doc);
    return proofreadDocument(clonedDoc, agentId, onProgress);
}
