// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import type {Node as ProseMirrorNode} from '@tiptap/pm/model';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';

export type InlineAnchor = {
    text: string;
    context_before: string;
    context_after: string;
    char_offset: number;
};

export type InlineCommentConfig = {
    onAddComment?: (anchor: InlineAnchor & {node_path: string[]}) => void;
    onCommentClick?: (commentId: string) => void;
    comments?: Array<{
        id: string;
        props: {
            inline_anchor?: InlineAnchor;
        };
    }>;
    editable?: boolean;
};

/**
 * Searches for a text pattern in the document and returns its ProseMirror position range.
 * This properly handles the mapping between plain text indices and document positions.
 *
 * @param doc - ProseMirror document node
 * @param searchText - The text to find
 * @param startCharIndex - Optional hint for where to start searching (plain text index)
 * @returns Position range {from, to} or null if not found
 */
function findTextInDocument(
    doc: ProseMirrorNode,
    searchText: string,
    startCharIndex?: number,
): {from: number; to: number} | null {
    if (!searchText) {
        return null;
    }

    let charCount = 0;
    let result: {from: number; to: number} | null = null;

    // Walk through document content
    doc.descendants((node, pos) => {
        if (result) {
            return false; // Already found, stop walking
        }

        if (node.isText && node.text) {
            const nodeText = node.text;
            const textLen = nodeText.length;

            // Check if the search text could start in this node
            // If we have a hint, skip nodes that are clearly before the expected position
            if (startCharIndex !== undefined && charCount + textLen <= startCharIndex) {
                charCount += textLen;
                return true; // Continue to next node
            }

            // Look for the search text starting in this node
            const searchStart = startCharIndex === undefined ? 0 : Math.max(0, startCharIndex - charCount);
            const idx = nodeText.indexOf(searchText, searchStart);

            if (idx !== -1) {
                // Found it! Calculate document positions
                const from = pos + idx;
                const to = from + searchText.length;

                // Verify by checking the text at these positions
                try {
                    const foundText = doc.textBetween(from, to);
                    if (foundText === searchText) {
                        result = {from, to};
                        return false; // Stop walking
                    }
                } catch {
                    // Position out of range, continue searching
                }
            }

            charCount += textLen;
        }
        return true; // Continue walking
    });

    // If not found with hint, try without hint (full search)
    if (!result && startCharIndex !== undefined) {
        return findTextInDocument(doc, searchText);
    }

    return result;
}

/**
 * Finds the position of anchor text in a ProseMirror document.
 * Uses a multi-strategy approach for resilience against document edits:
 * 1. Try stored char_offset (fast path - works when document unchanged)
 * 2. Search for exact text match using proper document position mapping
 *
 * @returns Position range {from, to} or null if text cannot be found
 */
function findAnchorPosition(
    doc: ProseMirrorNode,
    anchor: InlineAnchor,
): {from: number; to: number} | null {
    const {text, char_offset: offset} = anchor;

    if (!text) {
        return null;
    }

    const docSize = doc.content.size;

    // Strategy 1: Try stored offset (fast path)
    if (offset >= 0 && offset + text.length <= docSize) {
        try {
            const docText = doc.textBetween(offset, offset + text.length);
            if (docText === text) {
                return {from: offset, to: offset + text.length};
            }
        } catch {
            // Continue to fallback strategies
        }
    }

    // Strategy 2: Search for exact text using proper document traversal
    // This handles the case where text was inserted/deleted before the anchor
    const result = findTextInDocument(doc, text);
    if (result) {
        return result;
    }

    return null;
}

const InlineCommentExtension = Extension.create<InlineCommentConfig>({
    name: 'inlineComment',

    addOptions() {
        return {
            onAddComment: undefined,
            onCommentClick: undefined,
            comments: [],
            editable: true,
        };
    },

    addStorage() {
        return {
            comments: [],
        };
    },

    addProseMirrorPlugins() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias, consistent-this
        const extension = this;

        return [
            new Plugin({
                key: new PluginKey('inlineComment'),
                state: {
                    init() {
                        return {
                            selectedText: null as string | null,
                            selectedRange: null as {from: number; to: number} | null,
                        };
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    apply(tr, value) {
                        const {selection} = tr;
                        if (!selection.empty) {
                            const text = tr.doc.textBetween(selection.from, selection.to);
                            if (text.trim().length > 0) {
                                return {
                                    selectedText: text,
                                    selectedRange: {from: selection.from, to: selection.to},
                                };
                            }
                        }
                        return {selectedText: null, selectedRange: null};
                    },
                },
                props: {
                    decorations(state) {
                        const comments = extension.storage.comments || [];

                        if (comments.length === 0) {
                            return DecorationSet.empty;
                        }

                        const decorations: Decoration[] = [];
                        const doc = state.doc;

                        comments.forEach((comment: {id: string; props?: any}) => {
                            const anchor = comment.props?.inline_anchor as InlineAnchor | undefined;

                            if (!anchor) {
                                return;
                            }

                            const position = findAnchorPosition(doc, anchor);

                            if (position) {
                                decorations.push(
                                    Decoration.inline(position.from, position.to, {
                                        class: 'inline-comment-highlight',
                                        'data-comment-id': comment.id,
                                    }),
                                );
                            }
                        });

                        return DecorationSet.create(doc, decorations);
                    },
                    handleClickOn(view, pos, node, nodePos, event) {
                        const target = event.target as HTMLElement;

                        if (target.classList.contains('inline-comment-highlight')) {
                            const commentId = target.getAttribute('data-comment-id');
                            if (commentId && extension.options.onCommentClick) {
                                extension.options.onCommentClick(commentId);
                                return true;
                            }
                        }

                        return false;
                    },
                },
            }),
        ];
    },
});

export default InlineCommentExtension;
