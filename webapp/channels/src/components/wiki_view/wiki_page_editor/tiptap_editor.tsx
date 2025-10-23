// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension} from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import {Mention} from '@tiptap/extension-mention';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {useEditor, EditorContent} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, {useEffect} from 'react';
import {useSelector, useDispatch} from 'react-redux';

import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';

import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';

import WithTooltip from 'components/with_tooltip';

import {slugifyHeading} from 'utils/slugify_heading';

import type {GlobalState} from 'types/store';

import {createMMentionSuggestion} from './mention_mm_bridge';

import './tiptap_editor.scss';

// Custom heading extension that stores ID as an attribute
const HeadingWithId = Heading.extend({
    addAttributes() {
        const parentAttributes = this.parent?.() || {};
        return {
            ...parentAttributes,
            id: {
                default: null,
                parseHTML: (element: any) => element.getAttribute('id'),
                renderHTML: (attributes: any) => {
                    if (attributes.id) {
                        return {id: attributes.id};
                    }
                    return {};
                },
            },
        };
    },
});

// Plugin to auto-generate slugified IDs for headings
const HeadingIdPlugin = Extension.create({
    name: 'headingIdPlugin',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: new PluginKey('headingIdManager'),
                appendTransaction: (transactions, oldState, newState) => {
                    if (!transactions.some((tr) => tr.docChanged)) {
                        return null;
                    }

                    const tr = newState.tr;
                    const existingIds = new Set<string>();
                    let hasChanges = false;

                    newState.doc.descendants((node, pos) => {
                        if (node.type.name === 'heading') {
                            const headingText = node.textContent;
                            const currentId = node.attrs.id;

                            if (!currentId && headingText) {
                                const newId = slugifyHeading(headingText, existingIds);
                                tr.setNodeMarkup(pos, undefined, {
                                    ...node.attrs,
                                    id: newId,
                                });
                                existingIds.add(newId);
                                hasChanges = true;
                            } else if (currentId) {
                                existingIds.add(currentId);
                            }
                        }
                    });

                    return hasChanges ? tr : null;
                },
            }),
        ];
    },
});

type Props = {
    content: string;
    onContentChange: (content: string) => void;
    placeholder?: string;
    editable?: boolean;
    currentUserId?: string;
    channelId?: string;
    teamId?: string;
};

const getInitialContent = (content: string) => {
    if (!content || content === '') {
        return {type: 'doc', content: []};
    }

    try {
        return JSON.parse(content);
    } catch (e) {
        return {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{type: 'text', text: content}],
                },
            ],
        };
    }
};

const TipTapEditor = ({
    content,
    onContentChange,
    placeholder = "Type '/' to insert objects or start writing...",
    editable = true,
    currentUserId,
    channelId,
    teamId,
}: Props) => {
    const dispatch = useDispatch();
    const autocompleteGroups = useSelector((state: GlobalState) => {
        if (!teamId || !channelId) {
            return [];
        }
        return getAssociatedGroupsForReference(state, teamId, channelId);
    });

    const extensions = [
        StarterKit.configure({
            heading: false,
        }),
        HeadingWithId.configure({
            levels: [1, 2, 3],
        }),
        HeadingIdPlugin,
        Image.configure({
            HTMLAttributes: {
                class: 'wiki-image',
            },
        }),
    ];

    if (currentUserId && teamId) {
        extensions.push(
            Mention.configure({
                HTMLAttributes: {
                    class: 'mention',
                },
                suggestion: createMMentionSuggestion({
                    currentUserId,
                    channelId: channelId || '',
                    teamId,
                    autocompleteUsersInChannel: (prefix: string) => dispatch(autocompleteUsersInChannel(prefix, channelId || '')) as any,
                    searchAssociatedGroupsForReference: (prefix: string, tId: string, cId: string | undefined) => dispatch(searchAssociatedGroupsForReference(prefix, tId, cId)),
                    autocompleteGroups,
                    useChannelMentions: true,
                }) as any,
            }) as any,
        );
    }

    const editor = useEditor({
        extensions,
        content: getInitialContent(content),
        editable,
        onUpdate: ({editor: currentEditor}) => {
            const json = currentEditor.getJSON();
            onContentChange(JSON.stringify(json));
        },
        editorProps: {
            attributes: {
                class: 'tiptap-editor-content',
                'data-placeholder': placeholder,
            },
        },
    });

    useEffect(() => {
        if (!editor) {
            return;
        }

        const currentContent = JSON.stringify(editor.getJSON());
        if (content === currentContent) {
            return;
        }

        try {
            if (!content || content === '') {
                editor.commands.setContent({type: 'doc', content: []});
                return;
            }

            const parsedContent = JSON.parse(content);
            editor.commands.setContent(parsedContent);
        } catch (e) {
            editor.commands.setContent({
                type: 'doc',
                content: [
                    {
                        type: 'paragraph',
                        content: [{type: 'text', text: content}],
                    },
                ],
            });
        }
    }, [content, editor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(editable);
        }
    }, [editable, editor]);

    // Pre-fetch users for mentions when editor mounts
    useEffect(() => {
        if (channelId && editable) {
            dispatch(autocompleteUsersInChannel('', channelId));
        }
    }, [channelId, editable, dispatch]);

    if (!editor) {
        return null;
    }

    const isActive = (name: string, attrs?: Record<string, any>) => {
        return editor.isActive(name, attrs);
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;

        // TODO: Replace with proper URL input modal
        const url = previousUrl || 'https://';
        if (url === 'https://') {
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({href: url}).run();
    };

    const addImage = () => {
        // TODO: Replace with proper image upload/selection modal
        const url = 'https://via.placeholder.com/400x300';
        editor.chain().focus().setImage({src: url}).run();
    };

    return (
        <div className='tiptap-editor-wrapper'>
            <EditorContent editor={editor}/>

            {editable && (
                <div className='tiptap-toolbar'>
                    <WithTooltip title='Bold'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleBold().run()}
                            className={`btn btn-sm btn-icon ${isActive('bold') ? 'is-active' : ''}`}
                            title='Bold (Ctrl+B)'
                        >
                            <i className='icon icon-format-bold'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Italic'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleItalic().run()}
                            className={`btn btn-sm btn-icon ${isActive('italic') ? 'is-active' : ''}`}
                            title='Italic (Ctrl+I)'
                        >
                            <i className='icon icon-format-italic'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Strikethrough'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleStrike().run()}
                            className={`btn btn-sm btn-icon ${isActive('strike') ? 'is-active' : ''}`}
                            title='Strikethrough'
                        >
                            <i className='icon icon-format-strikethrough-variant'/>
                        </button>
                    </WithTooltip>

                    <span className='toolbar-divider'/>

                    <WithTooltip title='Heading 1'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
                            className={`btn btn-sm btn-icon ${isActive('heading', {level: 1}) ? 'is-active' : ''}`}
                            title='Heading 1'
                        >
                            <i className='icon icon-format-header-1'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Heading 2'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
                            className={`btn btn-sm btn-icon ${isActive('heading', {level: 2}) ? 'is-active' : ''}`}
                            title='Heading 2'
                        >
                            <i className='icon icon-format-header-2'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Heading 3'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
                            className={`btn btn-sm btn-icon ${isActive('heading', {level: 3}) ? 'is-active' : ''}`}
                            title='Heading 3'
                        >
                            <i className='icon icon-format-header-3'/>
                        </button>
                    </WithTooltip>

                    <span className='toolbar-divider'/>

                    <WithTooltip title='Bullet List'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleBulletList().run()}
                            className={`btn btn-sm btn-icon ${isActive('bulletList') ? 'is-active' : ''}`}
                            title='Bullet List'
                        >
                            <i className='icon icon-format-list-bulleted'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Numbered List'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleOrderedList().run()}
                            className={`btn btn-sm btn-icon ${isActive('orderedList') ? 'is-active' : ''}`}
                            title='Numbered List'
                        >
                            <i className='icon icon-format-list-numbered'/>
                        </button>
                    </WithTooltip>

                    <span className='toolbar-divider'/>

                    <WithTooltip title='Quote'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleBlockquote().run()}
                            className={`btn btn-sm btn-icon ${isActive('blockquote') ? 'is-active' : ''}`}
                            title='Quote'
                        >
                            <i className='icon icon-format-quote-open'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Code Block'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                            className={`btn btn-sm btn-icon ${isActive('codeBlock') ? 'is-active' : ''}`}
                            title='Code Block'
                        >
                            <i className='icon icon-code-tags'/>
                        </button>
                    </WithTooltip>

                    <span className='toolbar-divider'/>

                    <WithTooltip title='Add Link'>
                        <button
                            type='button'
                            onClick={setLink}
                            className={`btn btn-sm btn-icon ${isActive('link') ? 'is-active' : ''}`}
                            title='Add Link'
                        >
                            <i className='icon icon-link-variant'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Add Image'>
                        <button
                            type='button'
                            onClick={addImage}
                            className='btn btn-sm btn-icon'
                            title='Add Image'
                        >
                            <i className='icon icon-image-outline'/>
                        </button>
                    </WithTooltip>

                    <span className='toolbar-divider'/>

                    <WithTooltip title='Undo'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().undo().run()}
                            disabled={!editor.can().undo()}
                            className='btn btn-sm btn-icon'
                            title='Undo'
                        >
                            <i className='icon icon-refresh'/>
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Redo'>
                        <button
                            type='button'
                            onClick={() => editor.chain().focus().redo().run()}
                            disabled={!editor.can().redo()}
                            className='btn btn-sm btn-icon'
                            title='Redo'
                        >
                            <i className='icon icon-redo-variant'/>
                        </button>
                    </WithTooltip>
                </div>
            )}
        </div>
    );
};

export default TipTapEditor;
