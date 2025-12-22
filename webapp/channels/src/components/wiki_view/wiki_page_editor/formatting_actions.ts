// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';

export interface FormattingAction {
    id: string;
    title: string;
    description: string;
    icon: string;
    command: (editor: Editor) => void;
    isActive?: (editor: Editor) => boolean;
    aliases?: string[];
    category: 'text' | 'block' | 'list' | 'media' | 'advanced';
    keyboardShortcut?: string;
    requiresModal?: boolean;
    modalType?: 'link' | 'image' | 'emoji';
}

export const FORMATTING_ACTIONS: FormattingAction[] = [
    {
        id: 'bold',
        title: 'Bold',
        description: 'Make text bold',
        icon: 'icon-format-bold',
        command: (editor: Editor) => editor.chain().focus().toggleBold().run(),
        isActive: (editor: Editor) => editor.isActive('bold'),
        aliases: ['b', 'strong'],
        category: 'text',
        keyboardShortcut: 'Ctrl+B',
    },
    {
        id: 'italic',
        title: 'Italic',
        description: 'Make text italic',
        icon: 'icon-format-italic',
        command: (editor: Editor) => editor.chain().focus().toggleItalic().run(),
        isActive: (editor: Editor) => editor.isActive('italic'),
        aliases: ['i', 'em', 'emphasis'],
        category: 'text',
        keyboardShortcut: 'Ctrl+I',
    },
    {
        id: 'strike',
        title: 'Strikethrough',
        description: 'Strike through text',
        icon: 'icon-format-strikethrough-variant',
        command: (editor: Editor) => editor.chain().focus().toggleStrike().run(),
        isActive: (editor: Editor) => editor.isActive('strike'),
        aliases: ['strikethrough', 'del'],
        category: 'text',
    },
    {
        id: 'h1',
        title: 'Heading 1',
        description: 'Large section heading',
        icon: 'icon-format-header-1',
        command: (editor: Editor) => {
            const {from, to} = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection) {
                // Formatting bubble case: just toggle heading on selected text
                editor.chain().focus().toggleHeading({level: 1}).run();
            } else {
                // Slash command case: insert placeholder text
                editor.chain().
                    focus().
                    setHeading({level: 1}).
                    insertContent('Heading 1').
                    setTextSelection({from, to: from + 9}).
                    run();
            }
        },
        isActive: (editor: Editor) => editor.isActive('heading', {level: 1}),
        aliases: ['heading1', 'h1'],
        category: 'block',
    },
    {
        id: 'h2',
        title: 'Heading 2',
        description: 'Medium section heading',
        icon: 'icon-format-header-2',
        command: (editor: Editor) => {
            const {from, to} = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection) {
                // Formatting bubble case: just toggle heading on selected text
                editor.chain().focus().toggleHeading({level: 2}).run();
            } else {
                // Slash command case: insert placeholder text
                editor.chain().
                    focus().
                    setHeading({level: 2}).
                    insertContent('Heading 2').
                    setTextSelection({from, to: from + 9}).
                    run();
            }
        },
        isActive: (editor: Editor) => editor.isActive('heading', {level: 2}),
        aliases: ['heading2', 'h2'],
        category: 'block',
    },
    {
        id: 'h3',
        title: 'Heading 3',
        description: 'Small section heading',
        icon: 'icon-format-header-3',
        command: (editor: Editor) => {
            const {from, to} = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection) {
                // Formatting bubble case: just toggle heading on selected text
                editor.chain().focus().toggleHeading({level: 3}).run();
            } else {
                // Slash command case: insert placeholder text
                editor.chain().
                    focus().
                    setHeading({level: 3}).
                    insertContent('Heading 3').
                    setTextSelection({from, to: from + 9}).
                    run();
            }
        },
        isActive: (editor: Editor) => editor.isActive('heading', {level: 3}),
        aliases: ['heading3', 'h3'],
        category: 'block',
    },
    {
        id: 'bulletList',
        title: 'Bulleted list',
        description: 'Simple bulleted list',
        icon: 'icon-format-list-bulleted',
        command: (editor: Editor) => {
            editor.chain().
                focus().
                toggleBulletList().
                run();
        },
        isActive: (editor: Editor) => editor.isActive('bulletList'),
        aliases: ['ul', 'bulletlist', 'unordered'],
        category: 'list',
    },
    {
        id: 'orderedList',
        title: 'Numbered list',
        description: 'List with numbering',
        icon: 'icon-format-list-numbered',
        command: (editor: Editor) => {
            editor.chain().
                focus().
                toggleOrderedList().
                run();
        },
        isActive: (editor: Editor) => editor.isActive('orderedList'),
        aliases: ['ol', 'orderedlist', 'numbered'],
        category: 'list',
    },
    {
        id: 'blockquote',
        title: 'Quote',
        description: 'Capture a quote',
        icon: 'icon-format-quote-open',
        command: (editor: Editor) => {
            const {from, to} = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection) {
                editor.chain().focus().toggleBlockquote().run();
            } else {
                editor.chain().
                    focus().
                    insertContent({
                        type: 'blockquote',
                        content: [
                            {
                                type: 'paragraph',
                                content: [{type: 'text', text: 'Quote'}],
                            },
                        ],
                    }).
                    setTextSelection({from, to: from + 5}).
                    run();
            }
        },
        isActive: (editor: Editor) => editor.isActive('blockquote'),
        aliases: ['quote', 'citation'],
        category: 'block',
    },
    {
        id: 'callout',
        title: 'Callout',
        description: 'Highlight important information',
        icon: 'icon-information-outline',
        command: (editor: Editor) => {
            const {from, to} = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection) {
                editor.chain().focus().setCallout({type: 'info'}).run();
            } else {
                // Slash command case: insert callout and let cursor be placed inside
                // Don't try to manually set selection - let TipTap handle it
                editor.chain().
                    focus().
                    insertContent({
                        type: 'callout',
                        attrs: {type: 'info'},
                        content: [{type: 'paragraph'}],
                    }).
                    run();
            }
        },
        isActive: (editor: Editor) => editor.isActive('callout'),
        aliases: ['callout', 'alert', 'note', 'tip', 'warning', 'info'],
        category: 'block',
    },
    {
        id: 'codeBlock',
        title: 'Code block',
        description: 'Code with highlighting',
        icon: 'icon-code-tags',
        command: (editor: Editor) => {
            const {from, to} = editor.state.selection;
            const hasSelection = from !== to;

            if (hasSelection) {
                editor.chain().focus().toggleCodeBlock().run();
            } else {
                editor.chain().
                    focus().
                    insertContent({
                        type: 'codeBlock',
                        content: [{type: 'text', text: 'Code'}],
                    }).
                    setTextSelection({from, to: from + 4}).
                    run();
            }
        },
        isActive: (editor: Editor) => editor.isActive('codeBlock'),
        aliases: ['code', 'codeblock', 'pre'],
        category: 'block',
    },
    {
        id: 'link',
        title: 'Link',
        description: 'Add a link',
        icon: 'icon-link-variant',
        command: () => {}, // Handled by modal
        isActive: (editor: Editor) => editor.isActive('link'),
        aliases: ['hyperlink', 'url'],
        category: 'media',
        requiresModal: true,
        modalType: 'link',
    },
    {
        id: 'image',
        title: 'Image or Video',
        description: 'Add an image or video file',
        icon: 'icon-image-outline',
        command: () => {}, // Handled by modal
        aliases: ['picture', 'photo', 'img', 'video', 'media', 'mp4', 'mov'],
        category: 'media',
        requiresModal: true,
        modalType: 'image',
    },
    {
        id: 'emoji',
        title: 'Emoji',
        description: 'Insert an emoji',
        icon: 'icon-emoticon-happy-outline',
        command: (/* editor */) => {}, // Handled by emoji picker
        aliases: ['emoticon', 'smiley', 'face', 'reaction'],
        category: 'media',
        requiresModal: true,
        modalType: 'emoji',
    },
    {
        id: 'horizontalRule',
        title: 'Divider',
        description: 'Visual divider',
        icon: 'icon-minus',
        command: (editor: Editor) => editor.chain().focus().setHorizontalRule().run(),
        aliases: ['hr', 'divider', 'separator', 'line'],
        category: 'block',
    },
    {
        id: 'table',
        title: 'Table',
        description: 'Insert a table (3×3)',
        icon: 'icon-table-large',
        command: (editor: Editor) => editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run(),
        isActive: (editor: Editor) => editor.isActive('table'),
        aliases: ['grid'],
        category: 'advanced',
    },
];

export function filterFormattingActions(query: string): FormattingAction[] {
    if (!query || query.trim() === '') {
        return FORMATTING_ACTIONS;
    }

    const lowerQuery = query.toLowerCase().trim();

    return FORMATTING_ACTIONS.filter((action) => {
        if (action.title.toLowerCase().includes(lowerQuery)) {
            return true;
        }

        if (action.description.toLowerCase().includes(lowerQuery)) {
            return true;
        }

        if (action.aliases && action.aliases.some((alias) => alias.toLowerCase().includes(lowerQuery))) {
            return true;
        }

        return false;
    });
}

export function getFormattingActionById(id: string): FormattingAction | undefined {
    return FORMATTING_ACTIONS.find((action) => action.id === id);
}
