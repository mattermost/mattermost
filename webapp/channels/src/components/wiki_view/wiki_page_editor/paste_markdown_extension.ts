// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import marked from 'marked';

import {isUrlSafe} from 'utils/url';

const MAX_PASTE_SIZE = 64 * 1024;

// Strong signals - single match triggers conversion
const STRONG_SIGNALS = [
    /```[\s\S]+?```/, // fenced code blocks
    /^\|.+\|[\s\n]*\|[-:]+/m, // tables
    /!\[.*?\]\(.+?\)/, // images
];

// Medium signals - need 2+ matches
const MEDIUM_SIGNALS = [
    /^#{1,6}\s+\S/m, // headers
    /\[.+?\]\(.+?\)/, // links
    /(\*\*|__).+?\1/, // bold
    /^[-*+]\s+\S/m, // unordered lists
    /^\d+\.\s+\S/m, // ordered lists
    /^>\s+\S/m, // blockquotes
];

// Mention regex patterns matching server validation
// server/public/model/user.go: ^[a-z0-9\.\-_]+$ (lowercase, 1-64 chars)
// Exclude emails via negative lookbehind
const USER_MENTION_REGEX = /(?<![a-zA-Z0-9.@])@([a-z0-9._-]{1,64})(?![@.\w])/g;
const CHANNEL_MENTION_REGEX = /(?<![a-zA-Z0-9])~([a-z0-9][a-z0-9_-]{0,63})(?![\w])/g;

type MentionPlaceholder = {
    type: 'user' | 'channel';
    token: string;
    value: string;
};

type CodeFencePlaceholder = {
    token: string;
    content: string;
};

// Regex to match fenced code blocks (``` or ~~~) and inline code (single backticks)
// Order matters: fenced blocks first (greedy), then inline code
const CODE_FENCE_REGEX = /(```|~~~)[\s\S]*?\1|`[^`\n]+`/g;

/**
 * Detect if text looks like markdown based on signal heuristics.
 * Strong signals (code blocks, tables, images) trigger immediately.
 * Medium signals (headers, links, bold, lists) require 2+ matches.
 */
export function looksLikeMarkdown(text: string): boolean {
    if (text.length < 5 || text.startsWith('<')) {
        return false;
    }

    // Strong signals - single match is enough
    if (STRONG_SIGNALS.some((r) => r.test(text))) {
        return true;
    }

    // Medium signals - need 2+ matches
    const mediumMatches = MEDIUM_SIGNALS.filter((r) => r.test(text)).length;
    return mediumMatches >= 2;
}

/**
 * Escape special characters for HTML attribute values.
 */
function escapeAttr(s: string): string {
    return s.
        replace(/&/g, '&amp;').
        replace(/"/g, '&quot;').
        replace(/'/g, '&#39;').
        replace(/</g, '&lt;').
        replace(/>/g, '&gt;');
}

/**
 * Protect code fences from mention preprocessing.
 * Replaces code blocks with placeholders to prevent @mentions inside them from being processed.
 */
function protectCodeFences(inputText: string): {text: string; fences: CodeFencePlaceholder[]} {
    const fences: CodeFencePlaceholder[] = [];
    let counter = 0;

    const processedText = inputText.replace(CODE_FENCE_REGEX, (match) => {
        const token = `\u0007MMCODE${counter++}\u0007`;
        fences.push({token, content: match});
        return token;
    });

    return {text: processedText, fences};
}

/**
 * Restore code fences after mention preprocessing.
 */
function restoreCodeFences(inputText: string, fences: CodeFencePlaceholder[]): string {
    let result = inputText;
    for (const fence of fences) {
        result = result.replace(fence.token, fence.content);
    }
    return result;
}

/**
 * Pre-process mentions before markdown parsing.
 * Replaces @username and ~channel with unique placeholder tokens.
 * Protects code fences from mention processing.
 */
function preprocessMentions(inputText: string): {text: string; mentions: MentionPlaceholder[]} {
    const mentions: MentionPlaceholder[] = [];
    let counter = 0;

    // First, protect code fences from mention processing
    const {text: textWithProtectedFences, fences} = protectCodeFences(inputText);

    // Process user mentions (outside code fences)
    let processedText = textWithProtectedFences.replace(USER_MENTION_REGEX, (_, username) => {
        const token = `\u0007MMUSR${counter++}\u0007`;
        mentions.push({type: 'user', token, value: username});
        return token;
    });

    // Process channel mentions (outside code fences)
    processedText = processedText.replace(CHANNEL_MENTION_REGEX, (_, channelName) => {
        const token = `\u0007MMCHN${counter++}\u0007`;
        mentions.push({type: 'channel', token, value: channelName});
        return token;
    });

    // Restore code fences
    processedText = restoreCodeFences(processedText, fences);

    return {text: processedText, mentions};
}

/**
 * Post-process mentions after markdown parsing.
 * Replaces placeholder tokens with proper mention span elements.
 */
function postprocessMentions(inputHtml: string, mentions: MentionPlaceholder[]): string {
    let result = inputHtml;
    for (const m of mentions) {
        const escaped = escapeAttr(m.value);
        const span = m.type === 'user' ?
            `<span data-type="mention" data-id="${escaped}" data-label="${escaped}">@${escaped}</span>` :
            `<span data-type="channelMention" data-id="${escaped}" data-label="${escaped}">~${escaped}</span>`;
        result = result.replace(m.token, span);
    }
    return result;
}

/**
 * TipTap extension for pasting markdown as rich content.
 *
 * When plain text markdown is pasted:
 * 1. Detects markdown via signal heuristics
 * 2. Pre-processes @mentions and ~channels to placeholders
 * 3. Converts via marked.parse()
 * 4. Blocks dangerous URLs (javascript:, data:, vbscript:)
 * 5. Post-processes mention placeholders to proper nodes
 * 6. Inserts via TipTap (schema-based filtering handles XSS)
 */
export const PasteMarkdownExtension = Extension.create({
    name: 'pasteMarkdown',

    addProseMirrorPlugins() {
        const editor = this.editor;

        return [
            new Plugin({
                key: new PluginKey('pasteMarkdown'),
                props: {
                    handlePaste(view, event) {
                        const clipboardData = event.clipboardData;
                        if (!clipboardData) {
                            return false;
                        }

                        // Skip if HTML present (already rich content)
                        if (clipboardData.types.includes('text/html')) {
                            return false;
                        }

                        // Skip if files present (handled by filePasteHandler)
                        if (clipboardData.files.length > 0) {
                            return false;
                        }

                        const text = clipboardData.getData('text/plain');
                        if (!text || text.length > MAX_PASTE_SIZE) {
                            return false;
                        }

                        // Skip if cursor is in code block
                        const {$from} = view.state.selection;
                        if ($from.parent.type.spec.code) {
                            return false;
                        }

                        if (!looksLikeMarkdown(text)) {
                            return false;
                        }

                        try {
                            // Pre-process mentions
                            const {text: processedText, mentions} = preprocessMentions(text);

                            // Convert markdown to HTML
                            let html = marked(processedText) as string;

                            // Block dangerous URL protocols using the existing isUrlSafe utility
                            html = html.replace(/href="([^"]*)"/g, (match, url) => {
                                return isUrlSafe(url) ? match : 'href="#blocked"';
                            });

                            // Post-process mentions
                            html = postprocessMentions(html, mentions);

                            // Insert via TipTap (schema-based filtering handles unknown tags)
                            editor.commands.insertContent(html);
                            return true;
                        } catch {
                            // Fall back to default paste behavior
                            return false;
                        }
                    },
                },
            }),
        ];
    },
});

export default PasteMarkdownExtension;
