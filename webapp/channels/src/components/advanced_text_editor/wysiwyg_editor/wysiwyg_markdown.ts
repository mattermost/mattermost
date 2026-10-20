// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor, JSONContent} from '@tiptap/core';
import {MarkdownManager} from '@tiptap/markdown';

type MarkedToken = {type: string; raw: string; text?: string; tokens?: MarkedToken[]};

type MarkdownManagerInternals = {
    lexer: {lex: (markdown: string) => MarkedToken[]};
    instance: {
        Lexer: new (options: unknown) => MarkdownManagerInternals['lexer'];
        defaults: unknown;
        walkTokens: (tokens: MarkedToken[], callback: (token: MarkedToken) => void) => unknown;
    };
    parseTokens: (tokens: MarkedToken[]) => JSONContent[];
};

// The editor has no task list node, so `[ ]` / `[x]` stay as text and still post as checkboxes.
const keepTaskMarkerAsText = (token: MarkedToken) => {
    const tokens = token.tokens;
    if (tokens?.[0]?.type !== 'checkbox') {
        return;
    }

    const [checkbox, next] = tokens;
    const marker = {type: 'text', raw: checkbox.raw, text: checkbox.raw};
    if (next?.tokens) {
        tokens.shift();
        next.tokens.unshift(marker);
    } else {
        tokens[0] = marker;
    }
};

// Extension tokenizers (ordered lists, underline) run on the manager's lexer, so the
// document must be lexed by that same lexer or later blocks lose their inline content.
MarkdownManager.prototype.parse = function parse(markdown: string): JSONContent {
    const manager = this as unknown as MarkdownManagerInternals;
    manager.lexer = new manager.instance.Lexer(manager.instance.defaults);
    const tokens = manager.lexer.lex(markdown);
    manager.instance.walkTokens(tokens, keepTaskMarkerAsText);
    return {type: 'doc', content: manager.parseTokens(tokens)};
};

export const isRedundantLinkText = (text: string, href: string): boolean => {
    if (!text || !href) {
        return false;
    }

    return text === href ||
        href === `mailto:${text}` ||
        href === `http://${text}` ||
        href === `https://${text}`;
};

const getLinkHref = (node?: JSONContent): string | undefined => {
    if (node?.type !== 'text') {
        return undefined;
    }

    const href = node.marks?.find((mark) => mark.type === 'link')?.attrs?.href;
    return typeof href === 'string' ? href : undefined;
};

const withoutLinkMark = (node: JSONContent): JSONContent => {
    const marks = node.marks?.filter((mark) => mark.type !== 'link');
    return {...node, marks: marks?.length ? marks : undefined};
};

export const stripRedundantLinkMarks = (node: JSONContent): JSONContent => {
    const content = node.content;
    if (!Array.isArray(content) || content.length === 0) {
        return node;
    }

    const next: JSONContent[] = [];
    for (let i = 0; i < content.length; i++) {
        const href = getLinkHref(content[i]);
        if (!href) {
            next.push(stripRedundantLinkMarks(content[i]));
            continue;
        }

        let end = i;
        let text = '';
        while (end < content.length && getLinkHref(content[end]) === href) {
            text += content[end].text ?? '';
            end++;
        }

        const run = content.slice(i, end);
        next.push(...(isRedundantLinkText(text, href) ? run.map(withoutLinkMark) : run));
        i = end - 1;
    }

    return {...node, content: next};
};

export const parseMarkdownContent = (editor: Editor, markdown: string): JSONContent | undefined => {
    const doc = editor.markdown?.parse(markdown);
    if (!doc?.content) {
        return undefined;
    }

    return {
        ...doc,
        content: doc.content.map((node) => {
            const type = node.type ? editor.schema.nodes[node.type] : undefined;
            return type?.isInline ? {type: 'paragraph', content: [node]} : node;
        }),
    };
};

export const insertMarkdown = (editor: Editor, markdown: string): boolean => {
    try {
        const content = parseMarkdownContent(editor, markdown);
        return Boolean(content) && editor.commands.insertContent(content!);
    } catch {
        return false;
    }
};

export const plainTextContent = (text: string): JSONContent[] => text.split(/\r?\n/).map((line) => ({
    type: 'paragraph',
    content: line ? [{type: 'text', text: line}] : [],
}));

export const serializeToMarkdown = (editor: Editor): string => {
    const markdown = editor.markdown ?
        editor.markdown.serialize(stripRedundantLinkMarks(editor.getJSON())) :
        editor.getMarkdown();

    // Strip &nbsp; artifacts the @tiptap/markdown serializer leaves around
    // empty paragraphs at doc start/end.
    return markdown.trimEnd().
        replace(/\n\n&nbsp;\n/g, '\n').
        replace(/\n\n&nbsp;$/g, '').
        replace(/^&nbsp;$/, '');
};
