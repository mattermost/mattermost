// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';

import {DEFAULT_CALLOUT_TYPE} from './callout_extension';

export interface SlashCommandItem {
    id: string;
    title: string;
    description: string;
    icon: string;
    command: (editor: Editor) => void;
    aliases?: string[];
}

export const SLASH_COMMANDS: SlashCommandItem[] = [
    {
        id: 'h1',
        title: 'Heading 1',
        description: 'Large section heading',
        icon: 'H1',
        command: (editor: Editor) => {
            editor.chain().focus().toggleHeading({level: 1}).run();
        },
        aliases: ['heading1', 'h1'],
    },
    {
        id: 'h2',
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: 'H2',
        command: (editor: Editor) => {
            editor.chain().focus().toggleHeading({level: 2}).run();
        },
        aliases: ['heading2', 'h2'],
    },
    {
        id: 'h3',
        title: 'Heading 3',
        description: 'Small section heading',
        icon: 'H3',
        command: (editor: Editor) => {
            editor.chain().focus().toggleHeading({level: 3}).run();
        },
        aliases: ['heading3', 'h3'],
    },
    {
        id: 'bullet_list',
        title: 'Bulleted list',
        description: 'Simple bulleted list',
        icon: '•',
        command: (editor: Editor) => {
            editor.chain().focus().toggleBulletList().run();
        },
        aliases: ['ul', 'bulletlist', 'unordered'],
    },
    {
        id: 'numbered_list',
        title: 'Numbered list',
        description: 'List with numbering',
        icon: '1.',
        command: (editor: Editor) => {
            editor.chain().focus().toggleOrderedList().run();
        },
        aliases: ['ol', 'orderedlist', 'numbered'],
    },
    {
        id: 'quote',
        title: 'Quote',
        description: 'Capture a quote',
        icon: '>',
        command: (editor: Editor) => {
            editor.chain().focus().toggleBlockquote().run();
        },
        aliases: ['blockquote', 'citation'],
    },
    {
        id: 'callout',
        title: 'Callout',
        description: 'Highlight important information',
        icon: 'i',
        command: (editor: Editor) => {
            editor.chain().focus().toggleCallout({type: DEFAULT_CALLOUT_TYPE}).run();
        },
        aliases: ['callout', 'alert', 'note', 'tip', 'warning', 'info'],
    },
    {
        id: 'code_block',
        title: 'Code block',
        description: 'Code with highlighting',
        icon: '</>',
        command: (editor: Editor) => {
            editor.chain().focus().toggleCodeBlock().run();
        },
        aliases: ['code', 'codeblock', 'pre'],
    },
    {
        id: 'divider',
        title: 'Divider',
        description: 'Visual divider',
        icon: '—',
        command: (editor: Editor) => {
            editor.chain().focus().setHorizontalRule().run();
        },
        aliases: ['hr', 'horizontalrule', 'separator'],
    },
];

export function filterSlashCommands(query: string): SlashCommandItem[] {
    if (!query || query.trim() === '') {
        return SLASH_COMMANDS;
    }

    const lowerQuery = query.toLowerCase().trim();

    return SLASH_COMMANDS.filter((item) => {
        if (item.title.toLowerCase().includes(lowerQuery)) {
            return true;
        }

        if (item.description.toLowerCase().includes(lowerQuery)) {
            return true;
        }

        if (item.aliases && item.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery))) {
            return true;
        }

        return false;
    });
}
