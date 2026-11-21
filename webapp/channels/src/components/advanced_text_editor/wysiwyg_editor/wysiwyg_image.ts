// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor, JSONContent, MarkdownToken} from '@tiptap/core';
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

export type WysiwygImageConfig = {
    hasImageProxy: boolean;
    blockExternalImages: boolean;
    siteURL: string;
};

export type WysiwygImageOptions = WysiwygImageConfig;

export type WysiwygImageStorage = {
    config: WysiwygImageConfig;
    refreshers: Set<() => void>;
};

export function updateWysiwygImageConfig(editor: Editor, nextConfig: WysiwygImageConfig): void {
    const storage = (editor.storage as {image?: WysiwygImageStorage} | undefined)?.image;
    if (!storage) {
        return;
    }
    const prev = storage.config;
    if (
        prev.hasImageProxy === nextConfig.hasImageProxy &&
        prev.blockExternalImages === nextConfig.blockExternalImages &&
        prev.siteURL === nextConfig.siteURL
    ) {
        return;
    }
    storage.config = nextConfig;
    storage.refreshers.forEach((refresh) => refresh());
}

const INPUT_REGEX = /!\[([^\]]*)]\(((?:[^\s()]|\([^\s()]*\))+)(?:\s+["']([^"']*)["'])?\)$/;

const WysiwygImage = Node.create<WysiwygImageOptions, WysiwygImageStorage>({
    name: 'image',
    inline: true,
    group: 'inline',
    draggable: true,

    addStorage() {
        return {
            config: {
                hasImageProxy: this.options.hasImageProxy,
                blockExternalImages: this.options.blockExternalImages,
                siteURL: this.options.siteURL,
            },
            refreshers: new Set<() => void>(),
        };
    },

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
            {tag: 'img[src]'},
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
                        alt: el.getAttribute('data-alt') ?? el.textContent ?? null,
                        title: el.getAttribute('title'),
                    };
                },
            },
        ];
    },

    renderHTML({HTMLAttributes}) {
        const {src, ...rest} = HTMLAttributes;
        const config = this.storage?.config ?? this.options;
        const rawSrc = String(src ?? '');

        if (config.blockExternalImages && isExternalImageURL(rawSrc, config.siteURL)) {
            const alt = HTMLAttributes.alt ? String(HTMLAttributes.alt) : '';
            const attrs: Record<string, string> = {
                'data-blocked-image': 'true',
                'data-src': rawSrc,
            };
            if (HTMLAttributes.alt !== null && HTMLAttributes.alt !== undefined) {
                attrs['data-alt'] = alt;
            }
            if (HTMLAttributes.title) {
                attrs.title = String(HTMLAttributes.title);
            }
            return ['span', attrs, alt || unwrapImageProxyURL(rawSrc, config.siteURL)];
        }

        return ['img', mergeAttributes(rest, {
            class: 'markdown-inline-img',
            src: getImageSrc(rawSrc, config.hasImageProxy),
        })];
    },

    addNodeView() {
        const storage = this.storage;

        return ({node}) => {
            const dom = document.createElement('span');
            dom.style.display = 'contents';
            let currentNode = node;

            const renderContent = () => {
                const {config} = storage;
                const rawSrc = String(currentNode.attrs.src ?? '');
                const alt = currentNode.attrs.alt ? String(currentNode.attrs.alt) : '';
                const title = currentNode.attrs.title ? String(currentNode.attrs.title) : '';

                if (config.blockExternalImages && isExternalImageURL(rawSrc, config.siteURL)) {
                    const span = document.createElement('span');
                    span.setAttribute('data-blocked-image', 'true');
                    span.textContent = alt || unwrapImageProxyURL(rawSrc, config.siteURL);
                    if (title) {
                        span.setAttribute('title', title);
                    }
                    dom.replaceChildren(span);
                    return;
                }

                const img = document.createElement('img');
                img.className = 'markdown-inline-img';
                img.setAttribute('src', getImageSrc(rawSrc, config.hasImageProxy));
                if (currentNode.attrs.alt !== null && currentNode.attrs.alt !== undefined) {
                    img.setAttribute('alt', alt);
                }
                if (currentNode.attrs.title !== null && currentNode.attrs.title !== undefined) {
                    img.setAttribute('title', title);
                }
                dom.replaceChildren(img);
            };

            renderContent();
            storage.refreshers.add(renderContent);

            return {
                dom,
                update(updatedNode) {
                    if (updatedNode.type !== currentNode.type) {
                        return false;
                    }
                    currentNode = updatedNode;
                    renderContent();
                    return true;
                },
                destroy() {
                    storage.refreshers.delete(renderContent);
                },
            };
        };
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
