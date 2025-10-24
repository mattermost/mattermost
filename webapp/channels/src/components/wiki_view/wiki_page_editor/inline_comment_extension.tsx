// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';

export type InlineCommentConfig = {
    onAddComment?: (anchor: {
        text: string;
        context_before: string;
        context_after: string;
        node_path: string[];
        char_offset: number;
    }) => void;
    onCommentClick?: (commentId: string) => void;
    comments?: Array<{
        id: string;
        props: {
            inline_anchor?: {
                text: string;
                context_before: string;
                context_after: string;
                char_offset: number;
            };
        };
    }>;
};

const InlineCommentExtension = Extension.create<InlineCommentConfig>({
    name: 'inlineComment',

    addOptions() {
        return {
            onAddComment: undefined,
            onCommentClick: undefined,
            comments: [],
        };
    },

    addStorage() {
        return {
            comments: [],
        };
    },

    addProseMirrorPlugins() {
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
                        console.log('[InlineCommentExtension] decorations() called with', comments.length, 'comments:', comments);

                        if (comments.length === 0) {
                            console.log('[InlineCommentExtension] No comments, returning empty decoration set');
                            return DecorationSet.empty;
                        }

                        const decorations: Decoration[] = [];
                        const doc = state.doc;
                        console.log('[InlineCommentExtension] Document size:', doc.content.size, 'Text content:', doc.textContent);

                        comments.forEach((comment: {id: string; props?: any}) => {
                            const anchor = comment.props?.inline_anchor;
                            console.log('[InlineCommentExtension] Processing comment', comment.id, 'anchor:', anchor);

                            if (!anchor) {
                                console.log('[InlineCommentExtension] Comment', comment.id, 'has no anchor, skipping');
                                return;
                            }

                            const text = anchor.text;
                            const offset = anchor.char_offset || 0;
                            console.log('[InlineCommentExtension] Looking for text:', text, 'at offset:', offset);

                            try {
                                const from = offset;
                                const to = offset + text.length;
                                console.log('[InlineCommentExtension] Trying positions from:', from, 'to:', to);

                                if (from >= 0 && to <= doc.content.size) {
                                    const docText = doc.textBetween(from, to);
                                    console.log('[InlineCommentExtension] Text at position:', docText, 'Expected:', text, 'Match:', docText === text);

                                    if (docText === text) {
                                        decorations.push(
                                            Decoration.inline(from, to, {
                                                class: 'inline-comment-highlight',
                                                'data-comment-id': comment.id,
                                            }),
                                        );
                                        console.log('[InlineCommentExtension] Created decoration for comment', comment.id);
                                    } else {
                                        console.log('[InlineCommentExtension] Text mismatch - not creating decoration');
                                    }
                                } else {
                                    console.log('[InlineCommentExtension] Position out of bounds (doc size:', doc.content.size + ')');
                                }
                            } catch (error) {
                                console.error('[InlineCommentExtension] Failed to create decoration for comment:', comment.id, error);
                            }
                        });

                        console.log('[InlineCommentExtension] Created', decorations.length, 'decorations');
                        return DecorationSet.create(doc, decorations);
                    },
                    handleClickOn(view, pos, node, nodePos, event) {
                        const target = event.target as HTMLElement;
                        console.log('[InlineCommentExtension] handleClickOn triggered', {
                            hasHighlightClass: target.classList.contains('inline-comment-highlight'),
                            classList: Array.from(target.classList),
                            commentId: target.getAttribute('data-comment-id'),
                            hasCallback: !!extension.options.onCommentClick,
                        });
                        if (target.classList.contains('inline-comment-highlight')) {
                            const commentId = target.getAttribute('data-comment-id');
                            if (commentId && extension.options.onCommentClick) {
                                console.log('[InlineCommentExtension] Calling onCommentClick with:', commentId);
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
