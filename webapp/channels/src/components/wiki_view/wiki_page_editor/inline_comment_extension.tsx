// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';

import {ANCHOR_ID_PREFIX} from './comment_anchor_mark';

// Simplified anchor type - only text and anchor_id needed
export type InlineAnchor = {
    text: string;
    anchor_id: string;
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
 * Finds the comment ID that matches a given anchor ID.
 * Used to map from mark anchor IDs to comment post IDs.
 */
function findCommentByAnchorId(
    comments: Array<{id: string; props?: {inline_anchor?: InlineAnchor}}>,
    anchorId: string,
): string | null {
    const comment = comments.find(
        (c) => c.props?.inline_anchor?.anchor_id === anchorId,
    );
    return comment?.id ?? null;
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
                    apply(tr, _value) {
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
                    handleClickOn(view, pos, node, nodePos, event) {
                        const target = event.target as HTMLElement;

                        // Check if clicked on a comment anchor (mark-based approach)
                        if (target.classList.contains('comment-anchor')) {
                            const id = target.getAttribute('id');
                            if (id?.startsWith(ANCHOR_ID_PREFIX)) {
                                const anchorId = id.slice(ANCHOR_ID_PREFIX.length);
                                const comments = extension.storage.comments || [];
                                const commentId = findCommentByAnchorId(comments, anchorId);

                                if (commentId && extension.options.onCommentClick) {
                                    extension.options.onCommentClick(commentId);
                                    return true;
                                }
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
