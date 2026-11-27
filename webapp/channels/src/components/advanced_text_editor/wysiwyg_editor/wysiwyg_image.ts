// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {JSONContent, MarkdownToken} from '@tiptap/core';
import {InputRule, Node, mergeAttributes} from '@tiptap/core';

import {getImageSrc} from 'utils/post_utils';
import {isExternalImageURL, unwrapImageProxyURL} from 'utils/url';

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
    blockExternalImages: boolean;
    siteURL: string;
};

const INPUT_REGEX = /!\[([^\]]*)]\(((?:[^\s()]|\([^\s()]*\))+)(?:\s+["']([^"']*)["'])?\)$/;

const WysiwygImage = Node.create<WysiwygImageOptions>({
    name: 'image',
    inline: true,
    group: 'inline',
    draggable: true,

    addOptions() {
        return {
            hasImageProxy: false,
            blockExternalImages: false,
            siteURL: '',
        };
    },

    addAttributes() {
        return {
            src: {default: null},
            alt: {default: null},
            title: {default: null},
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-blocked-image]',
                getAttrs: (el) => {
                    if (typeof el === 'string') {
                        return false;
                    }
                    const src = el.getAttribute('data-src');
                    if (!src) {
                        return false;
                    }
                    return {
                        src,
                        alt: el.getAttribute('data-alt'),
                        title: el.getAttribute('data-title'),
                    };
                },
            },
            {tag: 'img[src]'},
        ];
    },

    renderHTML({HTMLAttributes}) {
        const {src, alt, title, ...rest} = HTMLAttributes;
        const rawSrc = String(src ?? '');

        if (this.options.blockExternalImages && isExternalImageURL(rawSrc, this.options.siteURL)) {
            const label = String(alt || unwrapImageProxyURL(rawSrc, this.options.siteURL));
            return ['span', mergeAttributes(rest, {
                'data-blocked-image': 'true',
                'data-src': rawSrc,
                'data-alt': alt ?? '',
                'data-title': title ?? '',
                class: 'markdown-inline-img--blocked',
            }), label];
        }

        return ['img', mergeAttributes(rest, {
            alt,
            title,
            class: 'markdown-inline-img',
            src: getImageSrc(rawSrc, this.options.hasImageProxy),
        })];
    },

    parseMarkdown: (token, helpers) => helpers.createNode('image', {
        src: token.href ?? '',
        alt: token.text ?? '',
        title: token.title ?? null,
    }),

    renderMarkdown: (node) => {
        const {src = '', alt = '', title} = node.attrs ?? {};
        const escapedAlt = String(alt).replace(/[\\[\]]/g, '\\$&');
        const escapedTitle = title ? ` "${String(title).replace(/["\\]/g, '\\$&')}"` : '';
        return `![${escapedAlt}](${src}${escapedTitle})`;
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
