// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor, JSONContent} from '@tiptap/core';

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
