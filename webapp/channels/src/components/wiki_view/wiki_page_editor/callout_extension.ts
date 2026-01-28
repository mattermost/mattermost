// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Node, mergeAttributes, findParentNode} from '@tiptap/core';

export const VALID_CALLOUT_TYPES = ['info', 'warning', 'success', 'error'] as const;
export type CalloutType = typeof VALID_CALLOUT_TYPES[number];
export const DEFAULT_CALLOUT_TYPE: CalloutType = 'info';

const CALLOUT_ARIA_LABELS: Record<CalloutType, string> = {
    info: 'Information callout',
    warning: 'Warning callout',
    success: 'Success callout',
    error: 'Error callout',
};

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        callout: {
            setCallout: (attrs?: {type?: CalloutType}) => ReturnType;
            toggleCallout: (attrs?: {type?: CalloutType}) => ReturnType;
            updateCalloutType: (type: CalloutType) => ReturnType;
            unsetCallout: () => ReturnType;
        };
    }
}

const Callout = Node.create({
    name: 'callout',
    group: 'block',
    content: 'block+',
    defining: true,
    isolating: true,

    addAttributes() {
        return {
            type: {
                default: DEFAULT_CALLOUT_TYPE,
                parseHTML: (element: HTMLElement) => {
                    const type = element.getAttribute('data-callout-type');
                    if (type && (VALID_CALLOUT_TYPES as readonly string[]).includes(type)) {
                        return type as CalloutType;
                    }
                    return DEFAULT_CALLOUT_TYPE;
                },
                renderHTML: (attributes: {type?: CalloutType}) => {
                    return {'data-callout-type': attributes.type || DEFAULT_CALLOUT_TYPE};
                },
            },
        };
    },

    parseHTML() {
        return [{tag: 'div[data-type="callout"]'}];
    },

    renderHTML({node, HTMLAttributes}) {
        const type = (node.attrs.type || DEFAULT_CALLOUT_TYPE) as CalloutType;
        const role = (type === 'warning' || type === 'error') ? 'alert' : 'note';
        return ['div', mergeAttributes(HTMLAttributes, {
            'data-type': 'callout',
            'data-callout-type': type,
            class: `callout callout-${type}`,
            role,
            'aria-label': CALLOUT_ARIA_LABELS[type],
        }), 0];
    },

    addCommands() {
        return {
            setCallout: (attrs) => ({commands}) => {
                return commands.wrapIn(this.name, attrs);
            },
            toggleCallout: (attrs) => ({commands, state, tr, dispatch}) => {
                const {selection} = state;
                const calloutNode = findParentNode((node) => node.type.name === 'callout')(selection);

                if (calloutNode) {
                    // Already inside a callout - unwrap it
                    // We can't use lift() because the callout has isolating: true
                    // So we manually replace the callout with its content
                    if (dispatch) {
                        const {node, pos} = calloutNode;
                        const endPos = pos + node.nodeSize;
                        const content = node.content;
                        tr.replaceWith(pos, endPos, content);
                        dispatch(tr);
                    }
                    return true;
                }

                // Not inside a callout - wrap the selection
                return commands.wrapIn(this.name, attrs);
            },
            updateCalloutType: (type: CalloutType) => ({tr, state, dispatch}) => {
                const {selection} = state;
                const calloutNode = findParentNode((node) => node.type.name === 'callout')(selection);
                if (!calloutNode) {
                    return false;
                }

                if (dispatch) {
                    tr.setNodeMarkup(calloutNode.pos, undefined, {
                        ...calloutNode.node.attrs,
                        type,
                    });
                    dispatch(tr);
                }
                return true;
            },
            unsetCallout: () => ({commands}) => {
                return commands.lift(this.name);
            },
        };
    },

    addKeyboardShortcuts() {
        return {
            Backspace: () => {
                const {state, view} = this.editor;
                const {selection} = state;
                const {$from, empty} = selection;

                // Only handle collapsed cursor (not selections)
                if (!empty) {
                    return false;
                }

                // Find if we're inside a callout
                const calloutNode = findParentNode((node) => node.type.name === 'callout')(selection);
                if (!calloutNode) {
                    return false;
                }

                // Check if cursor is at the very start of the first block inside the callout
                // $from.parentOffset is 0 when cursor is at the start of text in current block
                // We also need to verify we're in the first child of the callout
                const isAtStartOfBlock = $from.parentOffset === 0;

                // Check if we're in the first child of the callout
                // The first child starts at calloutNode.pos + 1
                const firstChildPos = calloutNode.pos + 1;
                const isInFirstChild = $from.before($from.depth) === firstChildPos;

                if (!isAtStartOfBlock || !isInFirstChild) {
                    return false;
                }

                // Check if the callout is empty (only contains an empty paragraph)
                // A callout is considered empty if it has no text content
                const calloutTextContent = calloutNode.node.textContent;
                if (!calloutTextContent || calloutTextContent.length === 0) {
                    // Delete the entire callout
                    const tr = state.tr.delete(calloutNode.pos, calloutNode.pos + calloutNode.node.nodeSize);
                    view.dispatch(tr);
                    return true;
                }

                // Callout has content - unwrap by replacing callout with its children
                // We can't use lift() because the callout has isolating: true
                const {node, pos} = calloutNode;
                const endPos = pos + node.nodeSize;

                // Create a transaction that replaces the callout with its content
                const tr = state.tr;

                // Get the content fragment from inside the callout
                const content = node.content;

                // Replace the callout node with its children
                tr.replaceWith(pos, endPos, content);

                view.dispatch(tr);
                return true;
            },
        };
    },
});

export default Callout;
