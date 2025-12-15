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
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {useEditor, EditorContent, ReactNodeViewRenderer, type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, {useEffect, useState, useMemo, useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch, shallowEqual} from 'react-redux';
import ImageResize from 'tiptap-extension-resize-image';

import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';

import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentTeam, getTeam} from 'mattermost-redux/selectors/entities/teams';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import {openModal} from 'actions/views/modals';

import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import FilePreviewModal from 'components/file_preview_modal';
import PageLinkModal from 'components/page_link_modal';
import TextInputModal from 'components/text_input_modal';

import {getHistory} from 'utils/browser_history';
import {ModalIdentifiers} from 'utils/constants';
import {canUploadFiles} from 'utils/file_utils';
import {slugifyHeading} from 'utils/slugify_heading';
import {getWikiUrl, isUrlSafe, isValidUrl} from 'utils/url';
import {generateId} from 'utils/utils';

import type {GlobalState} from 'types/store';

import {createChannelMentionSuggestion} from './channel_mention_mm_bridge';
import CommentAnchor from './comment_anchor_mark';
import CommentHighlightPlugin, {COMMENT_HIGHLIGHT_PLUGIN_KEY} from './comment_highlight_plugin';
import {uploadImageForEditor, validateImageFile} from './file_upload_helper';
import FormattingBarBubble from './formatting_bar_bubble';
import InlineCommentExtension from './inline_comment_extension';
import InlineCommentToolbar from './inline_comment_toolbar';
import {createMMentionSuggestion} from './mention_mm_bridge';
import MentionNodeView from './mention_node_view';
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

// Anchor type - matches InlineAnchor from inline_comment_extension.tsx
export type InlineAnchorData = {
    anchor_id: string;
    text: string;
};

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
    onCreateInlineComment?: (anchor: InlineAnchorData) => void;
    inlineComments?: Array<{
        id: string;
        props: {
            inline_anchor?: InlineAnchorData;
        };
    }>;
    onCommentClick?: (commentId: string) => void;
    deletedAnchorIds?: string[];
    onDeletedAnchorIdsProcessed?: () => void;
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

// Safe raster image data URI prefixes (matching backend sanitizeURL in page_content.go)
const SAFE_IMAGE_DATA_URI_PREFIXES = [
    'data:image/png',
    'data:image/jpeg',
    'data:image/jpg',
    'data:image/gif',
    'data:image/webp',
    'data:image/bmp',
];

/**
 * Validates an image URL for safe insertion into the editor.
 * Returns the validated URL if valid, null otherwise.
 * Matches backend sanitization in page_content.go
 */
const validateImageUrl = (url: string): string | null => {
    const trimmed = url.trim();
    if (!trimmed) {
        return null;
    }

    // Check for safe data URIs (raster images only, no SVG)
    const lower = trimmed.toLowerCase();
    if (lower.startsWith('data:')) {
        for (const prefix of SAFE_IMAGE_DATA_URI_PREFIXES) {
            if (lower.startsWith(prefix)) {
                return trimmed;
            }
        }
        return null; // Block SVG and other data URIs
    }

    // For regular URLs, must be safe and valid HTTP(S)
    if (!isUrlSafe(trimmed) || !isValidUrl(trimmed)) {
        return null;
    }

    return trimmed;
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
    deletedAnchorIds = [],
    onDeletedAnchorIdsProcessed,
}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const editorRef = useRef<Editor | null>(null);

    const [showLinkModal, setShowLinkModal] = useState(false);
    const [selectedText, setSelectedText] = useState('');
    const [showImageUrlModal, setShowImageUrlModal] = useState(false);
    const [, setServerError] = useState<(ServerError & {submittedMessage?: string}) | null>(null);

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

    // Get channels and team for channel mention click navigation
    const allChannels = useSelector(getAllChannels);
    const team = useSelector((state: GlobalState) => (teamId ? getTeam(state, teamId) : undefined));

    // Refs to hold current values for event handlers (avoids stale closures)
    const channelsRef = useRef(allChannels);
    const teamRef = useRef(team);
    useEffect(() => {
        channelsRef.current = allChannels;
    }, [allChannels]);
    useEffect(() => {
        teamRef.current = team;
    }, [team]);

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
            CommentAnchor,
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

            // Decoration-based highlighting for comments without marks
            CommentHighlightPlugin.configure({
                onCommentClick,
            }),
            Table.configure({
                resizable: true,
            }),
            TableRow,
            TableCell,
            TableHeader,
            TaskList,
            TaskItem.configure({
                nested: true,
            }),
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
                        const currentEditor = editorRef.current;
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
            // Uses AtMention component via NodeView to honor teammate name display preference
            exts.push(
                Mention.extend({
                    addOptions() {
                        return {
                            ...(this as any).parent?.(),
                            channelId: channelId || '',
                        };
                    },
                    addNodeView() {
                        // eslint-disable-next-line new-cap
                        return ReactNodeViewRenderer(MentionNodeView);
                    },
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
        editorRef.current = editor;

        // Expose editor for E2E testing
        if (editor) {
            // eslint-disable-next-line no-underscore-dangle
            (window as any).__tiptapEditor = editor;
        }

        return () => {
            editorRef.current = null;
            // eslint-disable-next-line no-underscore-dangle
            if ((window as any).__tiptapEditor === editor) {
                // eslint-disable-next-line no-underscore-dangle
                delete (window as any).__tiptapEditor;
            }
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

    // Update inline comments in both extensions when they change
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        // Update storage for click handling
        if ((editor.storage as any).inlineComment) {
            (editor.storage as any).inlineComment.comments = inlineComments;
        }

        // Update decoration plugin and trigger rebuild
        if ((editor.storage as any).commentHighlight) {
            (editor.storage as any).commentHighlight.comments = inlineComments;
            editor.view.dispatch(editor.state.tr.setMeta(COMMENT_HIGHLIGHT_PLUGIN_KEY, true));
        }

        // Update DOM classes for mark-based anchors
        const updateAnchorClasses = () => {
            const activeIds = new Set(
                inlineComments.map((c) => c.props?.inline_anchor?.anchor_id).filter(Boolean),
            );
            editor.view.dom.querySelectorAll('[id^="ic-"]').forEach((el) => {
                const anchorId = el.getAttribute('id')?.replace('ic-', '');
                el.classList.toggle('comment-anchor-active', Boolean(anchorId && activeIds.has(anchorId)));
            });
        };

        updateAnchorClasses();
        const timeoutId = setTimeout(updateAnchorClasses, 100);
        return () => clearTimeout(timeoutId);
    }, [editor, inlineComments]);

    // Remove marks for deleted comments (only when explicitly deleted, not resolved)
    useEffect(() => {
        if (!editor || deletedAnchorIds.length === 0) {
            return;
        }

        const {tr} = editor.state;
        let hasChanges = false;

        editor.state.doc.descendants((node, pos) => {
            if (node.isText && node.marks.length > 0) {
                node.marks.forEach((mark) => {
                    if (mark.type.name === 'commentAnchor' && deletedAnchorIds.includes(mark.attrs.anchorId)) {
                        tr.removeMark(pos, pos + node.nodeSize, mark.type);
                        hasChanges = true;
                    }
                });
            }
        });

        if (hasChanges) {
            editor.view.dispatch(tr);
        }

        // Clear the deleted anchor IDs after processing
        if (onDeletedAnchorIdsProcessed) {
            onDeletedAnchorIdsProcessed();
        }
    }, [editor, deletedAnchorIds, onDeletedAnchorIdsProcessed]);

    // Handle clicks on channel mentions to navigate to channel
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const handleClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            const channelMention = target.closest('.channel-mention[data-channel-id]');

            if (channelMention) {
                const mentionChannelId = channelMention.getAttribute('data-channel-id');
                const channels = channelsRef.current;
                const currentTeamData = teamRef.current;

                if (mentionChannelId && channels[mentionChannelId] && currentTeamData) {
                    event.preventDefault();
                    event.stopPropagation();

                    const channel = channels[mentionChannelId];
                    const history = getHistory();
                    const teamUrl = (window as any).basename || '';
                    const channelUrl = `${teamUrl}/${currentTeamData.name}/channels/${channel.name}`;
                    history.push(channelUrl);
                }
            }
        };

        const editorElement = editor.view.dom;
        editorElement.addEventListener('click', handleClick);

        return () => {
            editorElement.removeEventListener('click', handleClick);
        };
    }, [editor]);

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

    // Handle clicks on images in view mode to open preview modal
    useEffect(() => {
        if (!editor || editable) {
            return undefined;
        }

        const handleImageClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // Check if clicked element is an image (any img tag, not just .wiki-image)
            let imageElement: HTMLImageElement | null = null;
            if (target instanceof HTMLImageElement) {
                imageElement = target;
            }

            // Check if clicked element has an image parent
            if (!imageElement) {
                imageElement = target.closest('img') as HTMLImageElement | null;
            }

            // Check if clicked element is a wrapper containing an image (ImageResize wrapper)
            if (!imageElement && target instanceof HTMLElement) {
                imageElement = target.querySelector('img');
            }

            if (imageElement instanceof HTMLImageElement) {
                event.preventDefault();
                event.stopPropagation();

                const src = imageElement.getAttribute('src');
                const alt = imageElement.getAttribute('alt') || 'Image';
                const title = imageElement.getAttribute('title') || alt;

                if (src) {
                    // Extract extension from title/alt (filename) instead of src (API URL)
                    const filename = title || alt;
                    const lastDotIndex = filename.lastIndexOf('.');
                    let extension = 'png'; // default to png

                    if (lastDotIndex !== -1 && lastDotIndex < filename.length - 1) {
                        extension = filename.substring(lastDotIndex + 1).toLowerCase();
                    }

                    dispatch(openModal({
                        modalId: ModalIdentifiers.FILE_PREVIEW_MODAL,
                        dialogType: FilePreviewModal,
                        dialogProps: {
                            startIndex: 0,
                            postId: pageId,
                            fileInfos: [{
                                has_preview_image: false,
                                link: src,
                                extension,
                                name: filename,
                            }],
                        },
                    }));
                }
            }
        };

        const editorElement = editor.view.dom;
        editorElement.addEventListener('click', handleImageClick);

        return () => {
            editorElement.removeEventListener('click', handleImageClick);
        };
    }, [editor, editable, dispatch, pageId]);

    const handlePageSelect = useCallback((pageId: string, pageTitle: string, pageWikiId: string, linkText: string) => {
        if (!editor) {
            return;
        }

        // Use the selected page's wiki_id (not the current page's wikiId)
        const url = getWikiUrl(currentTeam?.name || 'team', channelId || '', pageWikiId, pageId);

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

        const {from, to} = selection;

        // Validate: selection must be within a single block
        const $from = editor.state.doc.resolve(from);
        const $to = editor.state.doc.resolve(to);
        if ($from.parent !== $to.parent) {
            return;
        }

        const anchorId = generateId();

        // Apply mark only in edit mode (decorations handle view mode)
        if (editable) {
            editor.chain().setMark('commentAnchor', {anchorId}).run();
        }

        onCreateInlineComment({
            anchor_id: anchorId,
            text: selection.text,
        });
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
                    helpText='Enter the URL of the image to insert (must be https://)'
                    confirmButtonText='Insert'
                    cancelButtonText='Cancel'
                    maxLength={2048}
                    onConfirm={(url) => {
                        const validatedUrl = validateImageUrl(url);
                        if (validatedUrl) {
                            editor.chain().focus().setImage({src: validatedUrl}).run();
                        }
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
