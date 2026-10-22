// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {tables} from '@guyplusplus/turndown-plugin-gfm';
import TurndownService from 'turndown';

function getAttribute(node: TurndownService.Node, name: string) {
    return node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement).getAttribute(name) : null;
}

function hasClass(node: TurndownService.Node, className: string) {
    return node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).classList.contains(className);
}

// Converts the HTML of a rendered post message back into Markdown. Unlike the converter used when
// pasting HTML, it knows about the markup Mattermost renders for mentions, hashtags and code blocks.
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '*',
    emDelimiter: '*',

    // Code blocks are rendered without a <pre>, so keep the whitespace of <code> elements
    preformattedCode: true,
});
turndownService.use(tables);

// Same as Turndown's list item rule, but with a single space after the marker like people type it
turndownService.addRule('listItem', {
    filter: 'li',
    replacement: (content, node, options) => {
        const parent = node.parentNode as HTMLElement | null;
        let prefix = `${options.bulletListMarker} `;
        if (parent?.nodeName === 'OL') {
            const start = parent.getAttribute('start');
            const index = Array.prototype.indexOf.call(parent.children, node);
            prefix = `${start ? Number(start) + index : index + 1}. `;
        }

        const indented = content.
            replace(/^\n+/, '').
            replace(/\n+$/, '\n').
            replace(/\n/gm, `\n${' '.repeat(prefix.length)}`);
        const separator = (node as HTMLElement).nextSibling && !(/\n$/).test(indented) ? '\n' : '';
        return prefix + indented + separator;
    },
});

turndownService.addRule('mention', {
    filter: (node) => Boolean(getAttribute(node, 'data-mention')),
    replacement: (_content, node) => `@${getAttribute(node, 'data-mention')}`,
});

turndownService.addRule('channelMention', {
    filter: (node) => Boolean(getAttribute(node, 'data-channel-mention')),
    replacement: (_content, node) => `~${getAttribute(node, 'data-channel-mention')}`,
});

turndownService.addRule('hashtag', {
    filter: (node) => Boolean(getAttribute(node, 'data-hashtag')),
    replacement: (_content, node) => getAttribute(node, 'data-hashtag')!,
});

turndownService.addRule('strikethrough', {
    filter: ['del', 's'],
    replacement: (content) => `~~${content}~~`,
});

turndownService.addRule('codeBlock', {
    filter: (node) => hasClass(node, 'post-code'),
    replacement: (_content, node) => {
        const code = ((node as HTMLElement).querySelector('code')?.textContent ?? '').replace(/\n$/, '');
        const language = getAttribute(node, 'data-language') ?? '';

        // Use a fence longer than any run of backticks in the code
        const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
        const fence = '`'.repeat(Math.max(3, longestRun + 1));

        return `\n\n${fence}${language}\n${code}\n${fence}\n\n`;
    },
});

/**
 * Converts the HTML of (part of) a rendered post message into Markdown.
 */
export function postHtmlToMarkdown(html: HTMLElement): string {
    return turndownService.turndown(html).trim();
}
