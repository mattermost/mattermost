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
 *
 * Also renders a transient "pending" decoration on the in-flight selection (A18) so the
 * user can see what text they are commenting on after focus leaves the editor for the
 * RHS comment textbox. The browser's native selection is dropped on focus shift; this
 * decoration preserves visual context.
 */
const CommentHighlightPlugin = Extension.create<CommentHighlightOptions>({
    name: 'commentHighlight',

    addStorage() {
        return {
            comments: [] as Comment[],
            pendingAnchor: null as InlineAnchor | null,
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
                        return buildDecorations(state.doc, storage.comments, storage.pendingAnchor);
                    },
                    apply(tr, oldDecorations, _, newState) {
                        if (tr.docChanged || tr.getMeta(COMMENT_HIGHLIGHT_PLUGIN_KEY)) {
                            return buildDecorations(newState.doc, storage.comments, storage.pendingAnchor);
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

                        // Walk up to handle nested decoration spans where event.target is the
                        // innermost element and the `data-comment-id` lives on an ancestor.
                        const highlightEl = target.closest('.inline-comment-highlight') as HTMLElement | null;
                        if (highlightEl) {
                            const commentId = highlightEl.getAttribute('data-comment-id');
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
 * Collect anchor mark ranges (anchorId + start/end positions) currently in the document.
 */
type MarkRange = {anchorId: string; from: number; to: number};

function getExistingMarkRanges(doc: any): MarkRange[] {
    const ranges: MarkRange[] = [];
    doc.descendants((node: any, pos: number) => {
        node.marks?.forEach((mark: any) => {
            if (mark.type.name === 'commentAnchor' && mark.attrs.anchorId) {
                ranges.push({anchorId: mark.attrs.anchorId, from: pos, to: pos + node.nodeSize});
            }
        });
        return true;
    });
    return ranges;
}

/**
 * Build decorations for comments that don't have marks. Also renders the pending
 * anchor (A18) if one is set.
 */
function buildDecorations(doc: any, comments: Comment[], pendingAnchor: InlineAnchor | null): DecorationSet {
    const decorations: Decoration[] = [];
    const markRanges = getExistingMarkRanges(doc);
    const existingMarkIds = new Set(markRanges.map((r) => r.anchorId));
    const activeIds = new Set(
        (comments ?? []).map((c) => c.props?.inline_anchor?.anchor_id).filter(Boolean) as string[],
    );

    // Active-highlight decoration for mark-backed anchors. Carrying the active class via a
    // ProseMirror decoration (rather than a post-render DOM toggle) makes it survive TipTap
    // view re-renders that would otherwise drop the class added imperatively.
    for (const range of markRanges) {
        if (activeIds.has(range.anchorId)) {
            decorations.push(
                Decoration.inline(range.from, range.to, {
                    class: 'comment-anchor-active',
                }),
            );
        }
    }

    if (comments?.length) {
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
    }

    // A18: pending-anchor decoration — visually preserve "what text am I commenting on"
    // after focus moves to the RHS comment textbox and the native selection is cleared.
    if (pendingAnchor?.text) {
        const position = findTextPosition(doc, pendingAnchor.text);
        if (position) {
            decorations.push(
                Decoration.inline(position.from, position.to, {
                    class: 'comment-anchor comment-anchor-pending inline-comment-highlight',
                    id: `ic-pending-${pendingAnchor.anchor_id}`,
                    'data-pending-anchor-id': pendingAnchor.anchor_id,
                }),
            );
        }
    }

    if (decorations.length === 0) {
        return DecorationSet.empty;
    }
    return DecorationSet.create(doc, decorations);
}

export default CommentHighlightPlugin;
