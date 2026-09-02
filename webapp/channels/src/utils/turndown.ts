// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {gfm} from '@guyplusplus/turndown-plugin-gfm';
import TurndownService from 'turndown';

import {getLanguageFromDisplayName} from 'utils/syntax_highlighting';

/**
 * Editors such as Google Docs wrap their content in a <b> or <i> which styles the emphasis away again. Without
 * this, pasting from them would turn the whole paste into bold or italic text.
 */
export function isEmphasisReset(node: HTMLElement): boolean {
    const {style} = node;

    switch (node.nodeName) {
    case 'B':
    case 'STRONG':
        return style.fontWeight === 'normal' || style.fontWeight === '400';
    case 'I':
    case 'EM':
        return style.fontStyle === 'normal';
    default:
        return false;
    }
}

const turndownService = new TurndownService({
    emDelimiter: '*',
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',

    // Keeps the line breaks of code that isn't wrapped in a <pre>, as is the case for Mattermost's code blocks.
    preformattedCode: true,
}).remove('style');

turndownService.use(gfm);

// Rules added below take precedence over the built-in and plugin rules.

// The GFM plugin uses a single tilde, which Mattermost doesn't render as strikethrough.
turndownService.addRule('strikethrough', {
    filter: (node) => ['DEL', 'S', 'STRIKE'].includes(node.nodeName),
    replacement: (content) => `~~${content}~~`,
});

turndownService.addRule('emphasisReset', {
    filter: isEmphasisReset,
    replacement: (content) => content,
});

// Mattermost renders code blocks alongside a copy button, a language label and a column of line numbers, none of
// which are part of the code itself.
turndownService.addRule('mattermostCodeBlock', {
    filter: (node) => node.nodeName === 'DIV' && node.classList.contains('post-code'),
    replacement: (content, node) => {
        const element = node as HTMLElement;
        const code = element.querySelector('code')?.textContent ?? '';
        const languageLabel = element.querySelector('.post-code__language')?.textContent ?? '';

        return `\n\n\`\`\`${getLanguageFromDisplayName(languageLabel)}\n${code}\n\`\`\`\n\n`;
    },
});

// Channel links and hashtags render as links, but their markdown is written with the mention itself.
turndownService.addRule('mattermostMentionLink', {
    filter: (node) => node.nodeName === 'A' && node.classList.contains('mention-link'),
    replacement: (content, node) => {
        const channelName = (node as HTMLElement).getAttribute('data-channel-mention');

        return channelName ? `~${channelName}` : content;
    },
});

export default turndownService;
