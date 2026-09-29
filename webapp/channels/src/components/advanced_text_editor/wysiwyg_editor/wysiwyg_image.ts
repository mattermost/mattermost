// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JSONContent, MarkdownToken} from '@tiptap/core';
import {InputRule, Node, mergeAttributes} from '@tiptap/core';

import {getImageSrc} from 'utils/post_utils';

declare module '@tiptap/core' {
    interface NodeConfig {
        parseMarkdown?: (token: MarkdownToken, helpers: MarkdownParseHelpers) => JSONContent;
        renderMarkdown?: (node: JSONContent) => string;
    }
}

type MarkdownParseHelpers = {
    createNode: (type: string, attrs?: Record<string, unknown>, content?: JSONContent[]) => JSONContent;
};

export type WysiwygImageOptions = {
    hasImageProxy: boolean;
};

const INPUT_REGEX = /!\[([^\]]*)]\(((?:[^\s()]|\([^\s()]*\))+)(?:\s+["']([^"']*)["'])?\)$/;

const WysiwygImage = Node.create<WysiwygImageOptions>({
    name: 'image',
    inline: true,
    group: 'inline',
    draggable: true,

    addOptions() {
        return {hasImageProxy: false};
    },

    addAttributes() {
        return {
            src: {default: null},
            alt: {default: null},
            title: {default: null},
        };
    },

    parseHTML() {
        return [{tag: 'img[src]'}];
    },

    renderHTML({HTMLAttributes}) {
        const {src, ...rest} = HTMLAttributes;

        return ['img', mergeAttributes(rest, {
            class: 'markdown-inline-img',
            src: getImageSrc(String(src ?? ''), this.options.hasImageProxy),
        })];
    },

    parseMarkdown: (token, helpers) => helpers.createNode('image', {
        src: token.href ?? '',
        alt: token.text ?? '',
        title: token.title ?? null,
    }),

    renderMarkdown: (node) => {
        const {src = '', alt = '', title} = node.attrs ?? {};
        return `![${alt}](${src}${title ? ` "${title}"` : ''})`;
    },

    addInputRules() {
        return [
            new InputRule({
                find: INPUT_REGEX,
                handler: ({state, range, match}) => {
                    state.tr.replaceWith(range.from, range.to, this.type.create({
                        alt: match[1],
                        src: match[2],
                        title: match[3],
                    }));
                },
            }),
        ];
    },
});

export default WysiwygImage;
