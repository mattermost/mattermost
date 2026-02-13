// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Node, mergeAttributes} from '@tiptap/core';
import {ReactNodeViewRenderer} from '@tiptap/react';

import FileAttachmentNodeView from './file_attachment_node_view';

export interface FileAttachmentOptions {
    HTMLAttributes: Record<string, unknown>;
}

export interface FileAttachmentAttributes {
    fileId: string | null;
    fileName: string;
    fileSize: number;
    mimeType: string;
    src: string;
    loading?: boolean;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        fileAttachment: {
            insertFileAttachment: (attrs: Partial<FileAttachmentAttributes>) => ReturnType;
        };
    }
}

const FileAttachment = Node.create<FileAttachmentOptions>({
    name: 'fileAttachment',
    group: 'block',
    atom: true,
    draggable: true,
    isolating: true,

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'wiki-file-attachment',
            },
        };
    },

    addAttributes() {
        return {
            fileId: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-file-id'),
                renderHTML: (attributes) => {
                    if (!attributes.fileId) {
                        return {};
                    }
                    return {'data-file-id': attributes.fileId};
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
            fileSize: {
                default: 0,
                parseHTML: (element) => {
                    const size = element.getAttribute('data-file-size');
                    return size ? parseInt(size, 10) : 0;
                },
                renderHTML: (attributes) => {
                    if (!attributes.fileSize) {
                        return {};
                    }
                    return {'data-file-size': attributes.fileSize.toString()};
                },
            },
            mimeType: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-mime-type'),
                renderHTML: (attributes) => {
                    if (!attributes.mimeType) {
                        return {};
                    }
                    return {'data-mime-type': attributes.mimeType};
                },
            },
            src: {
                default: '',
                parseHTML: (element) => element.getAttribute('data-src'),
                renderHTML: (attributes) => {
                    if (!attributes.src) {
                        return {};
                    }
                    return {'data-src': attributes.src};
                },
            },
            loading: {
                default: false,
                parseHTML: (element) => element.getAttribute('data-loading') === 'true',
                renderHTML: (attributes) => {
                    if (!attributes.loading) {
                        return {};
                    }
                    return {'data-loading': 'true'};
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'div[data-file-attachment]',
            },
        ];
    },

    renderHTML({HTMLAttributes}) {
        return [
            'div',
            mergeAttributes(
                this.options.HTMLAttributes,
                HTMLAttributes,
                {'data-file-attachment': ''},
            ),
        ];
    },

    addNodeView() {
        // eslint-disable-next-line new-cap
        return ReactNodeViewRenderer(FileAttachmentNodeView, {

            // Stop click events from propagating to ProseMirror
            // This allows our React click handlers to work properly
            stopEvent: ({event}) => {
                // Let the React component handle click events
                if (event.type === 'click' || event.type === 'mousedown' || event.type === 'keydown') {
                    return true;
                }
                return false;
            },
        });
    },

    addCommands() {
        return {
            insertFileAttachment:
                (attrs) =>
                    ({commands}) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs,
                        });
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

export default FileAttachment;
