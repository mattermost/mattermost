// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

/**
 * TipTap AI Utilities - Type Definitions
 *
 * These types support the text-nodes-only extraction and reassembly pipeline
 * for AI processing of wiki page content. The pipeline:
 * 1. Extracts text from safe node types (paragraphs, headings, lists)
 * 2. Skips protected content (code, mentions, images, files)
 * 3. Sends text to AI for processing
 * 4. Reassembles AI response back into original document structure
 */

/**
 * TipTap mark definition (bold, italic, link, etc.)
 */
export interface TipTapMark {
    type: string;
    attrs?: Record<string, unknown>;
}

/**
 * TipTap node attributes
 */
export interface TipTapNodeAttrs {
    level?: number;
    id?: string;
    href?: string;
    src?: string;
    alt?: string;
    title?: string;
    colspan?: number;
    rowspan?: number;
    checked?: boolean;
    [key: string]: unknown;
}

/**
 * TipTap node definition (recursive structure)
 */
export interface TipTapNode {
    type: string;
    attrs?: TipTapNodeAttrs;
    content?: TipTapNode[];
    text?: string;
    marks?: TipTapMark[];
}

/**
 * TipTap document (root node)
 */
export interface TipTapDoc extends TipTapNode {
    type: 'doc';
    content: TipTapNode[];
}

/**
 * Preserved mark with position information for reassembly.
 * Tracks where marks start and end within extracted text.
 */
export interface PreservedMark {
    type: string;
    attrs?: Record<string, unknown>;
    from: number;
    to: number;
}

/**
 * Represents a chunk of text extracted from a specific location in the document.
 * Contains all information needed to reassemble the text back into the original structure.
 */
export interface TextChunk {

    /** JSON path to this node (e.g., [0, 2, 1] means doc.content[0].content[2].content[1]) */
    path: number[];

    /** The node type this text came from (paragraph, heading, etc.) */
    nodeType: string;

    /** The extracted text content */
    text: string;

    /** Preserved marks with their positions */
    marks: PreservedMark[];

    /** Positions of hard breaks within the text (for <br> preservation) */
    hardBreakPositions: number[];

    /** Original node attributes (for heading level, etc.) */
    nodeAttrs?: TipTapNodeAttrs;
}

/**
 * Result of extracting text from a TipTap document.
 * Includes the chunks and metadata about what was skipped.
 */
export interface ExtractionResult {

    /** Extracted text chunks ready for AI processing */
    chunks: TextChunk[];

    /** Total character count of extracted text */
    totalCharacters: number;

    /** Count of nodes that were skipped (code, images, etc.) */
    skippedNodeCount: number;

    /** Types of nodes that were skipped */
    skippedNodeTypes: string[];
}

/**
 * Result of reassembling AI-processed text back into a TipTap document.
 */
export interface ReassemblyResult {

    /** The reassembled document */
    doc: TipTapDoc;

    /** Number of chunks that were successfully reassembled */
    chunksProcessed: number;

    /** Whether the reassembly was successful */
    success: boolean;

    /** Any warnings or issues encountered */
    warnings: string[];
}

/**
 * Result of validating a document after AI processing.
 */
export interface ValidationResult {

    /** Whether the document passed validation */
    valid: boolean;

    /** List of validation errors if any */
    errors: string[];

    /** Count of nodes by type in the document */
    nodeCounts: Record<string, number>;
}

/**
 * Node types that should NEVER be processed by AI.
 * These contain code, references, or binary content that AI should not modify.
 */
export const EXCLUDED_NODE_TYPES = [
    'codeBlock',
    'image',
    'imageResize',
    'video',
    'fileAttachment',
    'mention',
    'channelMention',
    'horizontalRule',
] as const;

/**
 * Node types that contain text we want to extract and process.
 * AI can safely modify the text content of these nodes.
 * Note: listItem and taskItem are STRUCTURAL because they contain
 * paragraphs, not direct text nodes.
 */
export const TEXT_CONTAINER_NODE_TYPES = [
    'paragraph',
    'heading',
    'blockquote',
    'callout',
] as const;

/**
 * Node types that are structural containers - we recurse into them
 * but don't extract text directly from them.
 * listItem and taskItem contain paragraphs, so they're structural.
 * Table nodes are structural: table → tableRow → tableCell/tableHeader → paragraph
 */
export const STRUCTURAL_NODE_TYPES = [
    'doc',
    'bulletList',
    'orderedList',
    'taskList',
    'listItem',
    'taskItem',
    'table',
    'tableRow',
    'tableCell',
    'tableHeader',
] as const;

/**
 * Mark types that should be preserved during AI processing.
 * Link hrefs are preserved but link text can be modified.
 */
export const PRESERVED_MARK_TYPES = [
    'bold',
    'italic',
    'strike',
    'code',
    'link',
    'commentAnchor',
] as const;

export type ExcludedNodeType = typeof EXCLUDED_NODE_TYPES[number];
export type TextContainerNodeType = typeof TEXT_CONTAINER_NODE_TYPES[number];
export type StructuralNodeType = typeof STRUCTURAL_NODE_TYPES[number];
export type PreservedMarkType = typeof PRESERVED_MARK_TYPES[number];

/**
 * Check if a node type should be excluded from AI processing.
 */
export function isExcludedNodeType(nodeType: string): boolean {
    return (EXCLUDED_NODE_TYPES as readonly string[]).includes(nodeType);
}

/**
 * Check if a node type is a text container we should extract from.
 */
export function isTextContainerNodeType(nodeType: string): boolean {
    return (TEXT_CONTAINER_NODE_TYPES as readonly string[]).includes(nodeType);
}

/**
 * Check if a node type is a structural container we should recurse into.
 */
export function isStructuralNodeType(nodeType: string): boolean {
    return (STRUCTURAL_NODE_TYPES as readonly string[]).includes(nodeType);
}
