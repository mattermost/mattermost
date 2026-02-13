// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Mark, mergeAttributes} from '@tiptap/core';
import type {Node} from '@tiptap/pm/model';
import {Fragment, Slice} from '@tiptap/pm/model';
import {Plugin, PluginKey} from '@tiptap/pm/state';

import {generateId} from 'utils/utils';

export const ANCHOR_ID_PREFIX = 'ic-';

/**
 * CommentAnchor mark for inline comment anchoring.
 *
 * This mark is applied to text that has an inline comment attached.
 * It uses native HTML `id` attribute for O(1) DOM lookup and CSS :target support.
 *
 * Design decisions:
 * - `inclusive: false` - prevents mark from growing when typing at edges
 * - `excludes: 'commentAnchor'` - only one anchor per position
 * - `priority: 1000` - renders outermost for easier click detection
 * - Smart paste/cut handling - preserves IDs on move, regenerates on copy
 */
const CommentAnchor = Mark.create({
    name: 'commentAnchor',

    // Prevent mark from growing when typing at edges
    inclusive: false,

    // Only one anchor per position
    excludes: 'commentAnchor',

    // Render outermost for easier click detection and CSS
    priority: 1000,

    addAttributes() {
        return {
            anchorId: {
                default: null,
                parseHTML: (element: HTMLElement) => {
                    const id = element.getAttribute('id');
                    if (id?.startsWith(ANCHOR_ID_PREFIX)) {
                        return id.slice(ANCHOR_ID_PREFIX.length);
                    }
                    return null;
                },
                renderHTML: (attributes: {anchorId?: string | null}) => {
                    if (!attributes.anchorId) {
                        return {};
                    }
                    return {id: `${ANCHOR_ID_PREFIX}${attributes.anchorId}`};
                },
            },
        };
    },

    parseHTML() {
        return [{tag: `span[id^="${ANCHOR_ID_PREFIX}"]`}];
    },

    renderHTML({HTMLAttributes}) {
        return ['span', mergeAttributes(HTMLAttributes, {class: 'comment-anchor'}), 0];
    },

    // Smart paste/cut handling - preserve IDs on move, regenerate on copy
    addProseMirrorPlugins() {
        const pluginKey = new PluginKey('commentAnchorPaste');

        return [
            new Plugin({
                key: pluginKey,
                state: {
                    init: () => ({wasCut: false}),
                    apply: (tr, state) => {
                        // Reset wasCut flag after transaction
                        if (tr.getMeta('paste')) {
                            return {wasCut: false};
                        }
                        return state;
                    },
                },
                props: {
                    handleDOMEvents: {
                        cut: (view) => {
                            // Mark that this was a cut operation
                            const tr = view.state.tr.setMeta(pluginKey, {wasCut: true});
                            view.dispatch(tr);
                            return false; // Don't prevent default
                        },
                        copy: (view) => {
                            // Ensure wasCut is false for copy
                            const tr = view.state.tr.setMeta(pluginKey, {wasCut: false});
                            view.dispatch(tr);
                            return false;
                        },
                    },
                    handlePaste: (view, event, slice) => {
                        const state = pluginKey.getState(view.state);

                        // If it was a cut (move), preserve IDs
                        if (state?.wasCut) {
                            return false; // Use default paste behavior
                        }

                        // Check if slice contains any commentAnchor marks
                        let hasAnchorMark = false;
                        slice.content.descendants((node: Node) => {
                            if (node.marks.some((mark) => mark.type.name === 'commentAnchor')) {
                                hasAnchorMark = true;
                                return false; // Stop traversal
                            }
                            return true;
                        });

                        // If no anchor marks, use default paste
                        if (!hasAnchorMark) {
                            return false;
                        }

                        // For copy-paste, regenerate IDs to avoid duplicates
                        const newSlice = regenerateAnchorIdsInSlice(slice, view.state.schema);
                        view.dispatch(view.state.tr.replaceSelection(newSlice));
                        return true; // We handled it
                    },
                },
            }),
        ];
    },
});

/**
 * Creates a new slice with regenerated anchor IDs
 */
function regenerateAnchorIdsInSlice(slice: Slice, schema: any): Slice {
    const fragment = regenerateAnchorIds(slice.content, schema);
    return new Slice(fragment, slice.openStart, slice.openEnd);
}

/**
 * Recursively regenerates anchor IDs in a fragment
 */
function regenerateAnchorIds(fragment: Fragment, schema: any): Fragment {
    const newNodes: Node[] = [];

    fragment.forEach((node: Node) => {
        if (node.isText && node.marks.length > 0) {
            const newMarks = node.marks.map((mark) => {
                if (mark.type.name === 'commentAnchor') {
                    return mark.type.create({anchorId: generateId()});
                }
                return mark;
            });
            newNodes.push(node.mark(newMarks));
        } else if (node.content.size > 0) {
            newNodes.push(node.copy(regenerateAnchorIds(node.content, schema)));
        } else {
            newNodes.push(node);
        }
    });

    return Fragment.from(newNodes);
}

export default CommentAnchor;
