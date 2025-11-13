// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension, mergeAttributes} from '@tiptap/core';
import Heading from '@tiptap/extension-heading';
import Link from '@tiptap/extension-link';
import {Mention} from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
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
import ImageResize from 'tiptap-extension-resize-image';

import type {Post} from '@mattermost/types/posts';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import store from 'stores/redux_store';

import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import TextInputModal from 'components/text_input_modal';

import {getHistory} from 'utils/browser_history';
import {PageConstants} from 'utils/constants';
import {canUploadFiles} from 'utils/file_utils';
import {slugifyHeading} from 'utils/slugify_heading';

import type {GlobalState} from 'types/store';

import {createChannelMentionSuggestion} from './channel_mention_mm_bridge';
import {uploadImageForEditor, validateImageFile} from './file_upload_helper';
import FormattingBarBubble from './formatting_bar_bubble';
import InlineCommentExtension from './inline_comment_extension';
import InlineCommentToolbar from './inline_comment_toolbar';
import {createMMentionSuggestion} from './mention_mm_bridge';
import PageLinkModal from './page_link_modal';
import {SlashCommandExtension} from './slash_command_extension';
import usePageRewrite from './use_page_rewrite';

import './tiptap_editor.scss';
import 'components/advanced_text_editor/use_rewrite.scss';

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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
    const [serverError, setServerError] = useState<any>(null);

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

                    if (position === undefined) {
                        currentEditor.chain().focus().setImage(imageAttrs).run();
                    } else {
                        currentEditor.chain().insertContentAt(position, {
                            type: 'image',
                            attrs: imageAttrs,
                        }).focus().run();
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
            Placeholder.configure({
                placeholder,
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
                    target: null,
                },
            }),
            HeadingWithId.configure({
                levels: [1, 2, 3],
            }),
            HeadingIdPlugin,
            ImageResize.configure({
                HTMLAttributes: {
                    class: 'wiki-image',
                },
            }),
            InlineCommentExtension.configure({
                comments: [], // Start with empty array, update via useEffect below
                onAddComment: onCreateInlineComment,
                onCommentClick,
                editable,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
        ];

        if (editable) {
            exts.push(SlashCommandExtension.configure({
                onOpenLinkModal: () => {
                    setShowLinkModal(true);
                },
                onOpenImageModal: () => {
                    if (!channelId || !uploadsEnabled) {
                        setShowImageUrlModal(true);
                        return;
                    }

                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';
                    input.multiple = false;

                    input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        // eslint-disable-next-line no-underscore-dangle
                        const currentEditor = (window as any).__tiptapEditor;
                        if (file && currentEditor) {
                            await handleImageUpload(currentEditor, file);
                        }
                    };

                    input.click();
                },
            }));
        }

        // Add custom image paste handler to prevent duplicate images
        if (editable && uploadsEnabled && channelId) {
            exts.push(
                Extension.create({
                    name: 'imagePasteHandler',

                    addProseMirrorPlugins() {
                        const editor = this.editor;

                        return [
                            new Plugin({
                                key: new PluginKey('imagePasteHandler'),
                                props: {
                                    handleDOMEvents: {
                                        paste(view, event) {
                                            const items = Array.from(event.clipboardData?.items || []);
                                            const imageItems = items.filter((item) => item.type.startsWith('image/'));

                                            if (imageItems.length === 0) {
                                                return false;
                                            }

                                            event.preventDefault();
                                            event.stopPropagation();

                                            imageItems.forEach((item) => {
                                                const file = item.getAsFile();
                                                if (file) {
                                                    handleImageUpload(editor, file);
                                                }
                                            });

                                            return true;
                                        },
                                        drop(view, event) {
                                            const files = Array.from(event.dataTransfer?.files || []);
                                            const imageFiles = files.filter((file) =>
                                                file.type.startsWith('image/'),
                                            );

                                            if (imageFiles.length === 0) {
                                                return false;
                                            }

                                            event.preventDefault();
                                            event.stopPropagation();

                                            const pos = view.posAtCoords({
                                                left: event.clientX,
                                                top: event.clientY,
                                            });

                                            imageFiles.forEach((file) => {
                                                handleImageUpload(
                                                    editor,
                                                    file,
                                                    pos?.pos,
                                                );
                                            });

                                            return true;
                                        },
                                    },
                                },
                            }),
                        ];
                    },
                }),
            );
        }

        if (currentUserId && teamId) {
            // User mentions (@username)
            exts.push(
                Mention.extend({
                    renderHTML({node, HTMLAttributes}: {node: any; HTMLAttributes: Record<string, any>}) {
                        return [
                            'span',
                            mergeAttributes(
                                {'data-type': this.name},
                                this.options.HTMLAttributes,
                                HTMLAttributes,
                            ),
                            `@${node.attrs.label ?? node.attrs.id}`,
                        ];
                    },
                }).configure({
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
        placeholder,
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
    }, [editable, placeholder]);

    // AI rewrite functionality
    const isAIAvailable = useGetAgentsBridgeEnabled();
    const {additionalControl: rewriteControl, openRewriteMenu} = usePageRewrite(editor, setServerError);

    useEffect(() => {
        if (editor) {
            // eslint-disable-next-line no-underscore-dangle
            (window as any).__tiptapEditor = editor;
        }
        return () => {
            // eslint-disable-next-line no-underscore-dangle
            (window as any).__tiptapEditor = null;
        };
    }, [editor]);

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

    // Handle clicks on wiki page links to navigate without full reload
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const wikiPageLink = target.closest('a.wiki-page-link');

            if (wikiPageLink) {
                const href = wikiPageLink.getAttribute('href');

                if (href) {
                    const currentOrigin = window.location.origin;
                    const currentBasename = (window as any).basename || '';

                    // Check if link is internal (same origin or relative path)
                    const isInternalLink = href.startsWith('/') ||
                        href.startsWith(currentOrigin) ||
                        href.startsWith(currentBasename);

                    if (isInternalLink) {
                        event.preventDefault();
                        event.stopPropagation();

                        const history = getHistory();
                        let relativePath = href;

                        // Strip origin if present
                        if (href.startsWith(currentOrigin)) {
                            relativePath = href.substring(currentOrigin.length);
                        }

                        // Strip basename if present
                        if (currentBasename && relativePath.startsWith(currentBasename)) {
                            relativePath = relativePath.substring(currentBasename.length);
                        }

                        history.push(relativePath);
                    }
                }
            }
        };

        const editorElement = editor.view.dom;
        editorElement.addEventListener('click', handleClick);

        return () => {
            editorElement.removeEventListener('click', handleClick);
        };
    }, [editor]);

    const handlePageSelect = useCallback((pageId: string, pageTitle: string, pageWikiId: string, linkText: string) => {
        if (!editor) {
            return;
        }

        // Use the selected page's wiki_id (not the current page's wikiId)
        const url = `/${currentTeam?.name || 'team'}/wiki/${channelId}/${pageWikiId}/${pageId}`;

        const {from, to} = editor.state.selection;

        // Always delete selection first (if any) and insert new link
        editor.
            chain().
            focus().
            deleteRange({from, to}).
            insertContent({
                type: 'text',
                text: linkText,
                marks: [{type: 'link', attrs: {href: url}}],
            }).

            // Unset the link mark from the stored marks to prevent future typing from extending this link
            command(({tr}) => {
                tr.removeStoredMark(editor.schema.marks.link);
                return true;
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

    const handleAIRewrite = () => {
        if (!editor) {
            return;
        }
        openRewriteMenu();
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
            {editor && editable && (() => {
                const commentHandler = onCreateInlineComment ? handleCreateComment : undefined;
                const aiRewriteHandler = isAIAvailable ? handleAIRewrite : undefined;
                return (
                    <FormattingBarBubble
                        editor={editor}
                        uploadsEnabled={uploadsEnabled && Boolean(channelId)}
                        onSetLink={setLink}
                        onAddImage={addImage}
                        onAddComment={commentHandler}
                        onAIRewrite={aiRewriteHandler}
                    />
                );
            })()}
            {editor && !editable && onCreateInlineComment && (
                <InlineCommentToolbar
                    editor={editor}
                    onCreateComment={handleCreateComment}
                    onAIRewrite={isAIAvailable ? handleAIRewrite : undefined}
                />
            )}
            {editor && isAIAvailable && rewriteControl}

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
