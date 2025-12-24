// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Node, mergeAttributes} from '@tiptap/core';

export interface VideoOptions {
    HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        video: {
            setVideo: (options: {src: string; title?: string; width?: number; height?: number}) => ReturnType;
        };
    }
}

const Video = Node.create<VideoOptions>({
    name: 'video',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
        return {
            HTMLAttributes: {
                class: 'wiki-video',
            },
        };
    },

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element) => element.getAttribute('src'),
                renderHTML: (attributes) => {
                    if (!attributes.src) {
                        return {};
                    }
                    return {src: attributes.src};
                },
            },
            title: {
                default: null,
                parseHTML: (element) => element.getAttribute('title'),
                renderHTML: (attributes) => {
                    if (!attributes.title) {
                        return {};
                    }
                    return {title: attributes.title};
                },
            },
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute('width'),
                renderHTML: (attributes) => {
                    if (!attributes.width) {
                        return {};
                    }
                    return {width: attributes.width};
                },
            },
            height: {
                default: null,
                parseHTML: (element) => element.getAttribute('height'),
                renderHTML: (attributes) => {
                    if (!attributes.height) {
                        return {};
                    }
                    return {height: attributes.height};
                },
            },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'video',
            },
        ];
    },

    renderHTML({HTMLAttributes}) {
        return [
            'video',
            mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
                controls: true,
                preload: 'metadata',
            }),
        ];
    },

    addCommands() {
        return {
            setVideo:
                (options) =>
                    ({commands}) => {
                        return commands.insertContent({
                            type: this.name,
                            attrs: options,
                        });
                    },
        };
    },
});

export default Video;
