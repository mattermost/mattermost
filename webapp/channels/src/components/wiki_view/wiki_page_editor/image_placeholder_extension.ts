// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Node, mergeAttributes} from '@tiptap/core';
import {ReactNodeViewRenderer} from '@tiptap/react';

import ImagePlaceholderNodeView from './image_placeholder_node_view';

export interface ImagePlaceholderOptions {
    HTMLAttributes: Record<string, unknown>;
}

export interface ImagePlaceholderAttributes {
    width: number;
    height: number;
    uploadId: string;
    fileName: string;
    isVideo: boolean;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        imagePlaceholder: {
            insertImagePlaceholder: (attrs: Partial<ImagePlaceholderAttributes>) => ReturnType;
            removeImagePlaceholder: (uploadId: string) => ReturnType;
            replaceImagePlaceholder: (uploadId: string, newContent: {type: string; attrs: Record<string, unknown>}) => ReturnType;
        };
    }
}

const ImagePlaceholder = Node.create<ImagePlaceholderOptions>({
    name: 'imagePlaceholder',
    group: 'block',
    atom: true,
    draggable: false,
    isolating: true,

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'wiki-image-placeholder',
            },
        };
    },

    addAttributes() {
        return {
            width: {
                default: 600,
                parseHTML: (element) => {
                    const w = element.getAttribute('data-width');
                    return w ? parseInt(w, 10) : 600;
                },
                renderHTML: (attributes) => {
                    return {'data-width': attributes.width.toString()};
                },
            },
            height: {
                default: 400,
                parseHTML: (element) => {
                    const h = element.getAttribute('data-height');
                    return h ? parseInt(h, 10) : 400;
                },
                renderHTML: (attributes) => {
                    return {'data-height': attributes.height.toString()};
                },
            },
            uploadId: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-upload-id'),
                renderHTML: (attributes) => {
                    if (!attributes.uploadId) {
                        return {};
                    }
                    return {'data-upload-id': attributes.uploadId};
                },
            },
            fileName: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-file-name'),
                renderHTML: (attributes) => {
                    if (!attributes.fileName) {
                        return {};
                    }
                    return {'data-file-name': attributes.fileName};
                },
            },
            isVideo: {
                default: false,
                parseHTML: (element) => element.getAttribute('data-is-video') === 'true',
                renderHTML: (attributes) => {
                    if (!attributes.isVideo) {
                        return {};
                    }
                    return {'data-is-video': 'true'};
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-image-placeholder]',
            },
        ];
    },

    renderHTML({HTMLAttributes}) {
        return [
            'div',
            mergeAttributes(
                this.options.HTMLAttributes,
                HTMLAttributes,
                {'data-image-placeholder': ''},
            ),
        ];
    },

    addNodeView() {
        // eslint-disable-next-line new-cap
        return ReactNodeViewRenderer(ImagePlaceholderNodeView);
    },

    addCommands() {
        return {
            insertImagePlaceholder:
                (attrs) =>
                    ({commands}) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs,
                        });
                    },

            removeImagePlaceholder:
                (uploadId) =>
                    ({tr, state, dispatch}) => {
                        let foundPos: number | null = null;
                        let foundNodeSize = 0;

                        state.doc.descendants((node, pos) => {
                            if (node.type.name === this.name && node.attrs.uploadId === uploadId) {
                                foundPos = pos;
                                foundNodeSize = node.nodeSize;
                                return false;
                            }
                            return true;
                        });

                        if (foundPos === null) {
                            return false;
                        }

                        if (dispatch) {
                            tr.delete(foundPos, foundPos + foundNodeSize);
                            dispatch(tr);
                        }
                        return true;
                    },

            replaceImagePlaceholder:
                (uploadId, newContent) =>
                    ({tr, state, dispatch}) => {
                        let foundPos: number | null = null;
                        let foundNodeSize = 0;

                        state.doc.descendants((node, pos) => {
                            if (node.type.name === this.name && node.attrs.uploadId === uploadId) {
                                foundPos = pos;
                                foundNodeSize = node.nodeSize;
                                return false;
                            }
                            return true;
                        });

                        if (foundPos === null) {
                            return false;
                        }

                        if (dispatch) {
                            const newNode = state.schema.nodes[newContent.type].create(newContent.attrs);
                            tr.replaceWith(foundPos, foundPos + foundNodeSize, newNode);
                            dispatch(tr);
                        }
                        return true;
                    },
        };
    },

    addKeyboardShortcuts() {
        return {
            Backspace: () => this.editor.commands.deleteSelection(),
            Delete: () => this.editor.commands.deleteSelection(),
        };
    },
});

export default ImagePlaceholder;
