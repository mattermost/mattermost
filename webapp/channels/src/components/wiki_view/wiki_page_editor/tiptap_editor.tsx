// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension, mergeAttributes} from '@tiptap/core';
import FileHandler from '@tiptap/extension-file-handler';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {Mention} from '@tiptap/extension-mention';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {useEditor, EditorContent, type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, {useEffect, useState, useMemo, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch, shallowEqual} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {getChannel} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import store from 'stores/redux_store';

import TextInputModal from 'components/text_input_modal';
import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import {PageConstants} from 'utils/constants';
import {canUploadFiles} from 'utils/file_utils';
import {slugifyHeading} from 'utils/slugify_heading';

import type {GlobalState} from 'types/store';

import {createChannelMentionSuggestion} from './channel_mention_mm_bridge';
import {uploadImageForEditor, validateImageFile} from './file_upload_helper';
import InlineCommentButton from './inline_comment_button';
import InlineCommentExtension from './inline_comment_extension';
import {createMMentionSuggestion} from './mention_mm_bridge';
import PageLinkModal from './page_link_modal';

import './tiptap_editor.scss';

// Custom heading extension that stores ID as an attribute
const HeadingWithId = Heading.extend({
    addAttributes() {
        return {
            level: {
                default: 1,
                rendered: false,
            },
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
    content: string | Record<string, any>; // Accept both string (legacy) and object
    contentKey?: string; // Cheap version key for content (e.g., page.message) to detect content changes
    onContentChange: (content: string) => void;
    placeholder?: string;
    editable?: boolean;
    currentUserId?: string;
    channelId?: string;
    teamId?: string;
    pageId?: string;
    wikiId?: string;
    pages?: Post[];
    onCreateInlineComment?: (anchor: {text: string; context_before: string; context_after: string; char_offset: number}) => void;
    inlineComments?: Array<{
        id: string;
        props: {
            inline_anchor?: {
                text: string;
                context_before: string;
                context_after: string;
                char_offset: number;
            };
        };
    }>;
    onCommentClick?: (commentId: string) => void;
};

const getInitialContent = (content: string | Record<string, any>) => {
    // If already an object, return it
    if (typeof content === 'object' && content !== null) {
        return content;
    }

    // Otherwise parse string
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
    pageId,
    wikiId,
    pages = [],
    onCreateInlineComment,
    inlineComments = [],
    onCommentClick,
}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const currentTeam = useSelector(getCurrentTeam);

    const [showLinkModal, setShowLinkModal] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [showImageUrlModal, setShowImageUrlModal] = useState(false);

    const autocompleteGroups = useSelector((state: GlobalState) => {
        if (!teamId || !channelId) {
            return [];
        }
        return getAssociatedGroupsForReference(state, teamId, channelId);
    }, (left, right) => {
        if (!Array.isArray(left) || !Array.isArray(right)) {
            return left === right;
        }
        if (left.length !== right.length) {
            return false;
        }
        return left.every((item, index) => item.id === right[index]?.id);
    });

    // Get file upload config from Redux - memoize to prevent recalculation on every Redux update
    const config = useSelector((state: GlobalState) => getConfig(state), shallowEqual);
    const maxFileSize = useMemo(() => parseInt(config.MaxFileSize || '', 10), [config.MaxFileSize]);
    const uploadsEnabled = useMemo(() => canUploadFiles(config), [config]);

    const handleImageUpload = useCallback(async (
        currentEditor: Editor,
        file: File,
        position?: number,
    ) => {
        const validation = validateImageFile(file, maxFileSize, intl);
        if (!validation.valid) {
            return;
        }

        try {
            await uploadImageForEditor({
                file,
                channelId: channelId || '',
                onSuccess: (result) => {
                    const imageUrl = `/api/v4/files/${result.fileInfo.id}`;
                    const imageAttrs = {
                        src: imageUrl,
                        alt: file.name,
                        title: file.name,
                    };

                    if (position !== undefined) {
                        currentEditor.chain().insertContentAt(position, {
                            type: 'image',
                            attrs: imageAttrs,
                        }).focus().run();
                    } else {
                        currentEditor.chain().focus().setImage(imageAttrs).run();
                    }
                },
            }, dispatch);
        } catch {
            // Upload error handled by uploadImageForEditor
        }
    }, [maxFileSize, intl, channelId]);

    // Memoize autocomplete handlers to prevent extensions from recreating on every Redux update
    const handleAutocompleteUsers = useCallback((prefix: string) => {
        return dispatch(autocompleteUsersInChannel(prefix, channelId || '')) as any;
    }, [dispatch, channelId]);

    const handleSearchGroups = useCallback((prefix: string, tId: string, cId: string | undefined) => {
        return dispatch(searchAssociatedGroupsForReference(prefix, tId, cId));
    }, [dispatch]);

    const handleAutocompleteChannels = useCallback((term: string, success: any, error: any) => {
        return dispatch(autocompleteChannels(term, success, error)) as any;
    }, [dispatch]);

    const extensions = useMemo(() => {
        const exts = [
            StarterKit.configure({
                heading: false,
                link: false,
            }),
            Link.extend({
                addKeyboardShortcuts() {
                    return {
                        'Mod-l': () => {
                            const {from, to} = this.editor.state.selection;
                            const text = this.editor.state.doc.textBetween(from, to, '');
                            setSelectedText(text);
                            setShowLinkModal(true);
                            return true;
                        },
                    };
                },
            }).configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'wiki-page-link',
                },
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
            InlineCommentExtension.configure({
                comments: [], // Start with empty array, update via useEffect below
                onAddComment: onCreateInlineComment,
                onCommentClick,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
        ];

        // Add FileHandler extension for drag-drop and paste image uploads
        if (editable && uploadsEnabled && channelId) {
            exts.push(
                FileHandler.configure({
                    allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
                    onDrop: (currentEditor, files, pos) => {
                        files.forEach(async (file) => {
                            await handleImageUpload(currentEditor, file, pos);
                        });
                    },
                    onPaste: (currentEditor, files) => {
                        if (files.length === 0) {
                            return false;
                        }

                        files.forEach(async (file) => {
                            await handleImageUpload(currentEditor, file);
                        });

                        return true;
                    },
                }),
            );
        }

        if (currentUserId && teamId) {
            // User mentions (@username)
            exts.push(
                Mention.configure({
                    HTMLAttributes: {
                        class: 'mention',
                    },
                    suggestion: createMMentionSuggestion({
                        currentUserId,
                        channelId: channelId || '',
                        teamId,
                        autocompleteUsersInChannel: handleAutocompleteUsers,
                        searchAssociatedGroupsForReference: handleSearchGroups,
                        autocompleteGroups,
                        useChannelMentions: true,
                    }) as any,
                }) as any,
            );

            // Channel mentions (~channel-name)
            exts.push(
                Mention.extend({
                    name: 'channelMention',
                    addAttributes() {
                        const parentAttrs = (this as any).parent?.() || {};
                        return {
                            ...parentAttrs,
                            'data-channel-id': {
                                default: null,
                                parseHTML: (element: HTMLElement) => element.getAttribute('data-channel-id'),
                                renderHTML: (attributes: Record<string, any>) => {
                                    if (!attributes['data-channel-id']) {
                                        return {};
                                    }
                                    return {
                                        'data-channel-id': attributes['data-channel-id'],
                                    };
                                },
                            },
                        };
                    },
                    parseHTML() {
                        return [
                            {
                                tag: `span[data-type="${this.name}"]`,
                            },
                        ];
                    },
                    renderHTML({node, HTMLAttributes}: {node: any; HTMLAttributes: Record<string, any>}) {
                        const channelId = node.attrs['data-channel-id'];
                        const channelName = node.attrs.label || node.attrs.id;

                        // Render as a clickable span with cursor pointer
                        return [
                            'span',
                            mergeAttributes(
                                {'data-type': this.name},
                                this.options.HTMLAttributes,
                                HTMLAttributes,
                                {
                                    'data-channel-id': channelId,
                                    style: 'cursor: pointer; text-decoration: underline;',
                                },
                            ),
                            `~${channelName}`,
                        ];
                    },
                }).configure({
                    HTMLAttributes: {
                        class: 'channel-mention',
                    },
                    suggestion: createChannelMentionSuggestion({
                        channelId: channelId || '',
                        teamId,
                        autocompleteChannels: handleAutocompleteChannels,
                        delayChannelAutocomplete: false,
                    }) as any,
                }) as any,
            );
        }

        return exts;
    }, [

        // NOTE: inlineComments is NOT in dependencies - we update them via useEffect below
        // This prevents extensions from recreating on every inline comment change
        onCreateInlineComment,
        onCommentClick,
        editable,
        uploadsEnabled,
        channelId,
        handleImageUpload,
        currentUserId,
        teamId,
        autocompleteGroups,
        handleAutocompleteUsers,
        handleSearchGroups,
        handleAutocompleteChannels,
    ]);

    const editorCreationStart = React.useRef(performance.now());
    React.useEffect(() => {
    }, []);

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
    }, [editable, placeholder]); // Only recreate editor when editable/placeholder changes, NOT when extensions change

    useEffect(() => {
        if (!editor) {
            return;
        }

        // Always update content - let TipTap handle if it's the same
        const contentToSet = getInitialContent(content);
        editor.commands.setContent(contentToSet);
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

    // Pre-fetch channels for channel mentions when editor mounts
    useEffect(() => {
        if (teamId && editable) {
            // Pre-fetch with empty query to cache all channels
            dispatch(autocompleteChannels('', () => {
                // Channels are now cached in Redux store for instant channel mention results
            }, () => {
                // Error case - channels will still work but may be slower
            }));
        }
    }, [teamId, editable]); // Removed dispatch from dependencies

    // Update inline comments when they change
    useEffect(() => {
        if (editor && (editor.storage as any).inlineComment) {
            (editor.storage as any).inlineComment.comments = inlineComments;

            // Force decorations to update
            editor.view.updateState(editor.state);
        }
    }, [editor, inlineComments]);

    // Handle clicks on channel mentions to navigate to channel
    // Using Mattermost pattern: access store.getState() directly inside handler to avoid subscriptions
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const channelMention = target.closest('.channel-mention[data-channel-id]');

            if (channelMention) {
                const channelId = channelMention.getAttribute('data-channel-id');

                // Mattermost pattern: Get channels and team directly from store without creating subscription
                const state = store.getState();
                const channels = state.entities.channels.channels;
                const teams = state.entities.teams.teams;

                if (channelId && channels[channelId] && teamId && teams[teamId]) {
                    event.preventDefault();
                    event.stopPropagation();

                    const channel = channels[channelId];
                    const team = teams[teamId];
                    const history = getHistory();
                    const teamUrl = (window as any).basename || '';
                    const channelUrl = `${teamUrl}/${team.name}/channels/${channel.name}`;
                    history.push(channelUrl);
                }
            }
        };

        const editorElement = editor.view.dom;
        editorElement.addEventListener('click', handleClick);

        return () => {
            editorElement.removeEventListener('click', handleClick);
        };
    }, [editor, teamId]);

    const handlePageSelect = useCallback((pageId: string, pageTitle: string, pageWikiId: string, linkText?: string) => {
        if (!editor) {
            return;
        }

        // Use the selected page's wiki_id (not the current page's wikiId)
        const url = `/${currentTeam?.name || 'team'}/wiki/${channelId}/${pageWikiId}/${pageId}`;

        const {from, to} = editor.state.selection;
        const hasSelection = from !== to;
        const selectedText = editor.state.doc.textBetween(from, to, '');

        // Determine final link text:
        // 1. If user provided custom link text in modal, use that
        // 2. Otherwise, if there's selected text, keep it (user wants to convert existing text to link)
        // 3. Otherwise, use the page title
        const finalLinkText = linkText || (hasSelection ? selectedText : pageTitle);

        // Always delete selection first (if any) and insert new link
        editor.
            chain().
            focus().
            deleteRange({from, to}).
            insertContent({
                type: 'text',
                text: finalLinkText,
                marks: [{type: 'link', attrs: {href: url}}],
            }).
            run();
    }, [editor, currentTeam, channelId]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Intercept Ctrl+L (or Cmd+L on Mac) to prevent global handler
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            if (editor && pages) {
                e.preventDefault();
                e.stopPropagation();

                const {from, to} = editor.state.selection;
                const text = editor.state.doc.textBetween(from, to, '');
                setSelectedText(text);
                setShowLinkModal(true);
            }
        }
    }, [editor, pages]);

    if (!editor) {
        return null;
    }

    const isActive = (name: string, attrs?: Record<string, any>) => {
        return editor.isActive(name, attrs);
    };

    const setLink = () => {
        const {from, to} = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '');
        setSelectedText(text);
        setShowLinkModal(true);
    };

    const addImage = () => {
        if (!channelId || !uploadsEnabled) {
            setShowImageUrlModal(true);
            return;
        }

        // Create hidden file input (reusing MM pattern)
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
        input.multiple = false;

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file && editor) {
                await handleImageUpload(editor, file);
            }
        };

        // Trigger file picker
        input.click();
    };

    const handleCreateComment = (selection: {text: string; from: number; to: number}) => {
        if (!editor || !onCreateInlineComment) {
            return;
        }

        const {state} = editor;
        const doc = state.doc;

        const contextBefore = doc.textBetween(Math.max(0, selection.from - PageConstants.INLINE_COMMENT_CONTEXT_LENGTH), selection.from).trim();
        const contextAfter = doc.textBetween(selection.to, Math.min(doc.content.size, selection.to + PageConstants.INLINE_COMMENT_CONTEXT_LENGTH)).trim();

        const anchor = {
            text: selection.text,
            context_before: contextBefore,
            context_after: contextAfter,
            char_offset: selection.from,
        };

        onCreateInlineComment(anchor);
    };

    return (
        <div
            className='tiptap-editor-wrapper'
            onKeyDown={handleKeyDown}
            data-testid='tiptap-editor-wrapper'
        >
            <EditorContent
                editor={editor}
                data-testid='tiptap-editor-content'
            />
            {editor && onCreateInlineComment && (
                <InlineCommentButton
                    editor={editor}
                    onCreateComment={handleCreateComment}
                />
            )}

            {showLinkModal && pages && (
                <PageLinkModal
                    pages={pages}
                    wikiId={wikiId || ''}
                    channelId={channelId || ''}
                    teamName={currentTeam?.name || 'team'}
                    onSelect={handlePageSelect}
                    onCancel={() => setShowLinkModal(false)}
                    initialLinkText={selectedText}
                />
            )}

            {showImageUrlModal && (
                <TextInputModal
                    show={showImageUrlModal}
                    title='Insert Image'
                    placeholder='https://example.com/image.png'
                    helpText='Enter the URL of the image to insert'
                    confirmButtonText='Insert'
                    cancelButtonText='Cancel'
                    maxLength={2048}
                    onConfirm={(url) => {
                        editor.chain().focus().setImage({src: url}).run();
                        setShowImageUrlModal(false);
                    }}
                    onCancel={() => setShowImageUrlModal(false)}
                />
            )}

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
                            data-testid='page-link-button'
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

                    <WithTooltip title='Insert Table (3x3)'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().insertTable({rows: 3, cols: 3, withHeaderRow: true}).run();
                            }}
                            className='btn btn-sm'
                            title='Insert Table (3x3)'
                            style={{fontSize: '18px', padding: '4px 8px'}}
                        >
                            ⊞
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Add Column Before'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().addColumnBefore().run();
                            }}
                            disabled={!editor.can().addColumnBefore()}
                            className='btn btn-sm'
                            title='Add Column Before'
                            style={{fontSize: '16px', padding: '4px 8px'}}
                        >
                            ◀|
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Add Column After'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().addColumnAfter().run();
                            }}
                            disabled={!editor.can().addColumnAfter()}
                            className='btn btn-sm'
                            title='Add Column After'
                            style={{fontSize: '16px', padding: '4px 8px'}}
                        >
                            |▶
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Delete Column'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().deleteColumn().run();
                            }}
                            disabled={!editor.can().deleteColumn()}
                            className='btn btn-sm'
                            title='Delete Column'
                            style={{fontSize: '16px', padding: '4px 8px'}}
                        >
                            ⊟|
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Add Row Before'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().addRowBefore().run();
                            }}
                            disabled={!editor.can().addRowBefore()}
                            className='btn btn-sm'
                            title='Add Row Before'
                            style={{fontSize: '16px', padding: '4px 8px'}}
                        >
                            ▲═
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Add Row After'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().addRowAfter().run();
                            }}
                            disabled={!editor.can().addRowAfter()}
                            className='btn btn-sm'
                            title='Add Row After'
                            style={{fontSize: '16px', padding: '4px 8px'}}
                        >
                            ═▼
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Delete Row'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().deleteRow().run();
                            }}
                            disabled={!editor.can().deleteRow()}
                            className='btn btn-sm'
                            title='Delete Row'
                            style={{fontSize: '16px', padding: '4px 8px'}}
                        >
                            ⊟═
                        </button>
                    </WithTooltip>

                    <WithTooltip title='Delete Table'>
                        <button
                            type='button'
                            onClick={() => {
                                editor.chain().focus().deleteTable().run();
                            }}
                            disabled={!editor.can().deleteTable()}
                            className='btn btn-sm'
                            title='Delete Table'
                            style={{fontSize: '16px', padding: '4px 8px'}}
                        >
                            🗑
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

// Custom comparison function to prevent unnecessary re-renders
// Only re-render if props that affect the editor actually change
const arePropsEqual = (prevProps: Props, nextProps: Props) => {
    // Compare primitive props
    if (
        prevProps.editable !== nextProps.editable ||
        prevProps.placeholder !== nextProps.placeholder ||
        prevProps.currentUserId !== nextProps.currentUserId ||
        prevProps.channelId !== nextProps.channelId ||
        prevProps.teamId !== nextProps.teamId ||
        prevProps.pageId !== nextProps.pageId ||
        prevProps.wikiId !== nextProps.wikiId
    ) {
        return false;
    }

    // Compare function props by reference (they should be memoized)
    if (prevProps.onContentChange !== nextProps.onContentChange) {
        return false;
    }
    if (prevProps.onCommentClick !== nextProps.onCommentClick) {
        return false;
    }
    if (prevProps.onCreateInlineComment !== nextProps.onCreateInlineComment) {
        return false;
    }

    // Compare inlineComments array - check if IDs changed
    if (prevProps.inlineComments?.length !== nextProps.inlineComments?.length) {
        return false;
    }

    // If we have inline comments, check if the IDs match (don't deep compare entire objects)
    if (prevProps.inlineComments && nextProps.inlineComments) {
        const prevIds = prevProps.inlineComments.map((c) => c.id).join(',');
        const nextIds = nextProps.inlineComments.map((c) => c.id).join(',');
        if (prevIds !== nextIds) {
            return false;
        }
    }

    // Content handling: In viewer mode, allow re-renders when content changes
    // In edit mode, ignore content to prevent re-renders during typing
    if (!nextProps.editable) {
        // Viewer mode: check contentKey to detect when content changes
        if (prevProps.contentKey !== nextProps.contentKey) {
            return false;
        }
    }

    return true; // Props are equal, skip re-render
};

export default React.memo(TipTapEditor, arePropsEqual);
