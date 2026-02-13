// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {Decoration, DecorationSet} from '@tiptap/pm/view';

import type {InlineAnchor} from 'types/store/pages';

import {findTextPosition} from './anchor_resolver';

type Comment = {
    id: string;
    props: {
        inline_anchor?: InlineAnchor;
    };
};

type CommentHighlightOptions = {
    comments: Comment[];
    onCommentClick?: (id: string) => void;
};

export const COMMENT_HIGHLIGHT_PLUGIN_KEY = new PluginKey('commentHighlight');

/**
 * Decoration-based highlight plugin for inline comments.
 * Used when marks don't exist in the document (e.g., comments created in view mode).
 */
const CommentHighlightPlugin = Extension.create<CommentHighlightOptions>({
    name: 'commentHighlight',

    addStorage() {
        return {
            comments: [] as Comment[],
        };
    },

    addProseMirrorPlugins() {
        const storage = this.storage;
        const options = this.options;

        return [
            new Plugin({
                key: COMMENT_HIGHLIGHT_PLUGIN_KEY,

                state: {
                    init(_, state) {
                        return buildDecorations(state.doc, storage.comments);
                    },
                    apply(tr, oldDecorations, _, newState) {
                        if (tr.docChanged || tr.getMeta(COMMENT_HIGHLIGHT_PLUGIN_KEY)) {
                            return buildDecorations(newState.doc, storage.comments);
                        }
                        return oldDecorations.map(tr.mapping, tr.doc);
                    },
                },

                props: {
                    decorations(state) {
                        return this.getState(state);
                    },
                    handleClickOn(view, pos, node, nodePos, event) {
                        const target = event.target as HTMLElement;
                        if (target.classList.contains('inline-comment-highlight')) {
                            const commentId = target.getAttribute('data-comment-id');
                            if (commentId && options.onCommentClick) {
                                options.onCommentClick(commentId);
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

/**
 * Collect anchor IDs that already have marks in the document.
 */
function getExistingMarkIds(doc: any): Set<string> {
    const ids = new Set<string>();
    doc.descendants((node: any) => {
        node.marks?.forEach((mark: any) => {
            if (mark.type.name === 'commentAnchor' && mark.attrs.anchorId) {
                ids.add(mark.attrs.anchorId);
            }
        });
        return true;
    });
    return ids;
}

/**
 * Build decorations for comments that don't have marks.
 */
function buildDecorations(doc: any, comments: Comment[]): DecorationSet {
    if (!comments?.length) {
        return DecorationSet.empty;
    }

    const existingMarkIds = getExistingMarkIds(doc);
    const decorations: Decoration[] = [];

    for (const comment of comments) {
        const anchor = comment.props?.inline_anchor;
        if (!anchor?.text || existingMarkIds.has(anchor.anchor_id)) {
            continue;
        }

        const position = findTextPosition(doc, anchor.text);
        if (position) {
            decorations.push(
                Decoration.inline(position.from, position.to, {
                    class: 'comment-anchor comment-anchor-active inline-comment-highlight',
                    id: `ic-${anchor.anchor_id}`,
                    'data-comment-id': comment.id,
                }),
            );
        }
    }

    return DecorationSet.create(doc, decorations);
}

export default CommentHighlightPlugin;
