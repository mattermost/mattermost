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
            toggleCallout: (attrs) => ({commands}) => {
                return commands.toggleWrap(this.name, attrs);
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
});

export default Callout;
