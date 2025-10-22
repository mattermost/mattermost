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

import type {GlobalState} from 'types/store';

import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';

import {slugifyHeading} from 'utils/slugify_heading';

import {createMMentionSuggestion} from './mention_mm_bridge';

import './tiptap_editor.scss';

// Custom heading extension that stores ID as an attribute
const HeadingWithId = Heading.extend({
    addAttributes() {
        // @ts-expect-error - TipTap's parent property is not in the type definition
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
                                console.log('[HeadingIdPlugin] Generated ID:', {
                                    text: headingText,
                                    id: newId,
                                    pos,
                                });
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

    console.log('[TipTapEditor] Received content:', {
        contentLength: content?.length || 0,
        contentPreview: content?.substring(0, 100),
        editable,
        currentUserId,
        channelId,
        teamId,
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
        console.log('[TipTapEditor] Adding Mention extension with config:', {
            currentUserId,
            teamId,
            channelId: channelId || 'none',
            autocompleteGroups: autocompleteGroups?.length || 0,
        });
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
    } else {
        console.log('[TipTapEditor] NOT adding Mention extension - missing props:', {
            hasCurrentUserId: !!currentUserId,
            hasChannelId: !!channelId,
            hasTeamId: !!teamId,
        });
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

    if (!editor) {
        return null;
    }

    const isActive = (name: string, attrs?: Record<string, any>) => {
        return editor.isActive(name, attrs);
    };

    const setLink = () => {
        const previousUrl = editor.getAttributes('link').href;
        const url = window.prompt('Enter URL:', previousUrl);

        if (url === null) {
            return;
        }

        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }

        editor.chain().focus().extendMarkRange('link').setLink({href: url}).run();
    };

    const addImage = () => {
        const url = window.prompt('Enter image URL:');

        if (url) {
            editor.chain().focus().setImage({src: url}).run();
        }
    };

    return (
        <div className='tiptap-editor-wrapper'>
            <EditorContent editor={editor}/>

            {editable && (
                <div className='tiptap-toolbar'>
                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        className={isActive('bold') ? 'is-active' : ''}
                        title='Bold (Ctrl+B)'
                    >
                        <i className='icon icon-format-bold'/>
                        <span className='toolbar-text'>{'Bold'}</span>
                    </button>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        className={isActive('italic') ? 'is-active' : ''}
                        title='Italic (Ctrl+I)'
                    >
                        <i className='icon icon-format-italic'/>
                        <span className='toolbar-text'>{'Italic'}</span>
                    </button>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        className={isActive('strike') ? 'is-active' : ''}
                        title='Strikethrough'
                    >
                        <i className='icon icon-format-strikethrough'/>
                        <span className='toolbar-text'>{'Strike'}</span>
                    </button>

                    <span className='toolbar-divider'/>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleHeading({level: 1}).run()}
                        className={isActive('heading', {level: 1}) ? 'is-active' : ''}
                        title='Heading 1'
                    >
                        <span className='toolbar-text'>{'H1'}</span>
                    </button>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleHeading({level: 2}).run()}
                        className={isActive('heading', {level: 2}) ? 'is-active' : ''}
                        title='Heading 2'
                    >
                        <span className='toolbar-text'>{'H2'}</span>
                    </button>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleHeading({level: 3}).run()}
                        className={isActive('heading', {level: 3}) ? 'is-active' : ''}
                        title='Heading 3'
                    >
                        <span className='toolbar-text'>{'H3'}</span>
                    </button>

                    <span className='toolbar-divider'/>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        className={isActive('bulletList') ? 'is-active' : ''}
                        title='Bullet List'
                    >
                        <i className='icon icon-format-list-bulleted'/>
                        <span className='toolbar-text'>{'List'}</span>
                    </button>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        className={isActive('orderedList') ? 'is-active' : ''}
                        title='Numbered List'
                    >
                        <i className='icon icon-format-list-numbered'/>
                        <span className='toolbar-text'>{'Numbered'}</span>
                    </button>

                    <span className='toolbar-divider'/>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleBlockquote().run()}
                        className={isActive('blockquote') ? 'is-active' : ''}
                        title='Quote'
                    >
                        <i className='icon icon-format-quote-close'/>
                        <span className='toolbar-text'>{'Quote'}</span>
                    </button>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                        className={isActive('codeBlock') ? 'is-active' : ''}
                        title='Code Block'
                    >
                        <i className='icon icon-code-tags'/>
                        <span className='toolbar-text'>{'Code'}</span>
                    </button>

                    <span className='toolbar-divider'/>

                    <button
                        type='button'
                        onClick={setLink}
                        className={isActive('link') ? 'is-active' : ''}
                        title='Add Link'
                    >
                        <i className='icon icon-link-variant'/>
                        <span className='toolbar-text'>{'Link'}</span>
                    </button>

                    <button
                        type='button'
                        onClick={addImage}
                        title='Add Image'
                    >
                        <i className='icon icon-image-outline'/>
                        <span className='toolbar-text'>{'Image'}</span>
                    </button>

                    <span className='toolbar-divider'/>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title='Undo'
                    >
                        <i className='icon icon-undo-variant'/>
                    </button>

                    <button
                        type='button'
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title='Redo'
                    >
                        <i className='icon icon-redo-variant'/>
                    </button>
                </div>
            )}
        </div>
    );
};

export default TipTapEditor;
