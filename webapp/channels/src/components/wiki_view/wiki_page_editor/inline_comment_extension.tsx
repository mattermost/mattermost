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
                            const anchor = comment.props?.inline_anchor;

                            if (!anchor) {
                                return;
                            }

                            const text = anchor.text;
                            const offset = anchor.char_offset || 0;

                            try {
                                const from = offset;
                                const to = offset + text.length;

                                if (from >= 0 && to <= doc.content.size) {
                                    const docText = doc.textBetween(from, to);

                                    if (docText === text) {
                                        decorations.push(
                                            Decoration.inline(from, to, {
                                                class: 'inline-comment-highlight',
                                                'data-comment-id': comment.id,
                                            }),
                                        );
                                    }
                                }
                            } catch (error) {
                                // Silently skip comments that fail to create decorations
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
