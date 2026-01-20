// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Extension, mergeAttributes} from '@tiptap/core';
import Color from '@tiptap/extension-color';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import {Mention} from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import {Table} from '@tiptap/extension-table';
import {TableCell} from '@tiptap/extension-table-cell';
import {TableHeader} from '@tiptap/extension-table-header';
import {TableRow} from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import {TextStyle} from '@tiptap/extension-text-style';
import {Plugin, PluginKey} from '@tiptap/pm/state';
import {useEditor, EditorContent, ReactNodeViewRenderer, type Editor} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import React, {useEffect, useState, useMemo, useCallback, useRef} from 'react';
import {useIntl} from 'react-intl';
import {useSelector, useDispatch, shallowEqual} from 'react-redux';
import ImageResize from 'tiptap-extension-resize-image';

import type {Emoji} from '@mattermost/types/emojis';
import type {ServerError} from '@mattermost/types/errors';
import type {Post} from '@mattermost/types/posts';

import {getAgents} from 'mattermost-redux/selectors/entities/agents';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getAssociatedGroupsForReference} from 'mattermost-redux/selectors/entities/groups';
import {getCurrentTeam, getTeam} from 'mattermost-redux/selectors/entities/teams';
import {getEmojiName, isSystemEmoji} from 'mattermost-redux/utils/emoji_utils';

import {autocompleteChannels} from 'actions/channel_actions';
import {autocompleteUsersInChannel} from 'actions/views/channel';
import {searchAssociatedGroupsForReference} from 'actions/views/group';
import {openModal} from 'actions/views/modals';

import useGetAgentsBridgeEnabled from 'components/common/hooks/useGetAgentsBridgeEnabled';
import useVisionCapability from 'components/common/hooks/useVisionCapability';
import useEmojiPicker from 'components/emoji_picker/use_emoji_picker';
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

// Extend Window interface for E2E testing
declare global {
    interface Window {
        e2eTiptapEditor?: Editor;
    }
}

import {
    usePageProofread,
    usePageTranslate,
    TranslatePageModal,
    ImageAIBubble,
    ImageExtractionDialog,
    ImageExtractionCompleteDialog,
    useImageAI,
} from './ai';
import type {ImageAIAction} from './ai';
import Callout from './callout_extension';
import {createChannelMentionSuggestion} from './channel_mention_mm_bridge';
import CommentAnchor from './comment_anchor_mark';
import CommentHighlightPlugin, {COMMENT_HIGHLIGHT_PLUGIN_KEY} from './comment_highlight_plugin';
import FileAttachment from './file_attachment_extension';
import {uploadMediaForEditor, validateFile, isVideoFile, isMediaFile} from './file_upload_helper';
import FormattingBarBubble from './formatting_bar_bubble';
import InlineCommentExtension from './inline_comment_extension';
import InlineCommentToolbar from './inline_comment_toolbar';
import {createMMentionSuggestion} from './mention_mm_bridge';
import MentionNodeView from './mention_node_view';
import {SlashCommandExtension} from './slash_command_extension';
import usePageRewrite from './use_page_rewrite';
import Video from './video_extension';

import './tiptap_editor.scss';
import 'components/advanced_text_editor/use_rewrite.scss';

// Custom heading extension that stores ID as an attribute and renders it
const HeadingWithId = Heading.extend({
    addAttributes() {
        return {
            level: {
                default: 1,
            },
            id: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('id'),
                renderHTML: (attributes: Record<string, unknown>) => {
                    if (attributes.id) {
                        return {id: attributes.id as string};
                    }
                    return {};
                },
            },
        };
    },
    renderHTML({node, HTMLAttributes}: {node: {attrs: {level?: number; id?: string}}; HTMLAttributes: Record<string, unknown>}) {
        const level = (node.attrs.level || 1) as 1 | 2 | 3 | 4 | 5 | 6;
        const hasLevel = this.options.levels.includes(level);
        const tag = `h${hasLevel ? level : this.options.levels[0]}` as keyof HTMLElementTagNameMap;

        return [tag, mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
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

// AI tools handlers exposed to parent components
export type AIToolsHandlers = {
    proofread: () => void;
    openTranslateModal: () => void;
    isProcessing: boolean;
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
    pageTitle?: string;
    pageParentId?: string | null;
    wikiId?: string;
    pages?: Post[];
    isExistingPage?: boolean;
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
    onTranslatedPageCreated?: (pageId: string) => void;
    onAIToolsReady?: (handlers: AIToolsHandlers | null) => void;
};

/**
 * Sanitizes TipTap content to prevent crashes in prosemirror.
 * Fixes malformed content by:
 * - Removing invalid text nodes (text nodes without a "text" property)
 * - Ensuring each table row has valid cells with colspan/rowspan >= 1
 * - Removing empty rows (rows with no cells)
 * - Removing empty tables (tables with no valid rows)
 * - Adding default content to empty cells
 */
const sanitizeContent = (node: any): any => {
    if (!node || typeof node !== 'object') {
        return node;
    }

    // Fix invalid text nodes: text nodes MUST have a "text" property
    // This can happen from malformed Confluence imports
    if (node.type === 'text' && typeof node.text !== 'string') {
        // Return null to filter out this invalid node
        return null;
    }

    // Recursively process children first
    if (Array.isArray(node.content)) {
        node.content = node.content.map(sanitizeContent).filter(Boolean);
    }

    // Sanitize table nodes
    if (node.type === 'table' && Array.isArray(node.content)) {
        // Process each row
        node.content = node.content.map((row: any) => {
            if (row?.type === 'tableRow' && Array.isArray(row.content)) {
                row.content = row.content.map((cell: any) => {
                    if (cell?.type === 'tableCell' || cell?.type === 'tableHeader') {
                        // Initialize attrs if missing
                        if (!cell.attrs) {
                            cell.attrs = {};
                        }

                        // Ensure colspan and rowspan are valid (>= 1, capped at 100)
                        const MAX_SPAN = 100;
                        if (typeof cell.attrs.colspan !== 'number' || cell.attrs.colspan < 1) {
                            cell.attrs.colspan = 1;
                        } else if (cell.attrs.colspan > MAX_SPAN) {
                            cell.attrs.colspan = MAX_SPAN;
                        }
                        if (typeof cell.attrs.rowspan !== 'number' || cell.attrs.rowspan < 1) {
                            cell.attrs.rowspan = 1;
                        } else if (cell.attrs.rowspan > MAX_SPAN) {
                            cell.attrs.rowspan = MAX_SPAN;
                        }

                        // Ensure cell has content array
                        if (!Array.isArray(cell.content) || cell.content.length === 0) {
                            cell.content = [{type: 'paragraph', content: []}];
                        }
                    }
                    return cell;
                }).filter((cell: any) => cell?.type === 'tableCell' || cell?.type === 'tableHeader');

                // Remove rows with no valid cells
                if (row.content.length === 0) {
                    return null;
                }
            }
            return row;
        }).filter(Boolean);

        // Remove tables with no valid rows
        if (node.content.length === 0) {
            return {type: 'paragraph', content: []};
        }
    }

    return node;
};

const getInitialContent = (content: string | Record<string, any>) => {
    // If already an object, deep clone and sanitize to avoid mutating the original
    if (typeof content === 'object' && content !== null) {
        try {
            const cloned = JSON.parse(JSON.stringify(content));
            return sanitizeContent(cloned);
        } catch {
            return {type: 'doc', content: []};
        }
    }

    // Otherwise parse string
    if (!content || content === '') {
        return {type: 'doc', content: []};
    }

    try {
        const parsed = JSON.parse(content);
        return sanitizeContent(parsed);
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
    pageTitle = '',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pageParentId = null,
    wikiId,
    pages = [],
    isExistingPage = false,
    onCreateInlineComment,
    inlineComments = [],
    onCommentClick,
    deletedAnchorIds = [],
    onDeletedAnchorIdsProcessed,
    onTranslatedPageCreated,
    onAIToolsReady,
}: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const currentTeam = useSelector(getCurrentTeam);
    const editorRef = useRef<Editor | null>(null);

    const [, setServerError] = useState<(ServerError & {submittedMessage?: string}) | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

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
    // These refs allow callbacks inside extensions to access current values without
    // being dependencies of the extensions useMemo, preventing unnecessary recreation.
    const channelsRef = useRef(allChannels);
    const teamRef = useRef(team);
    const pagesRef = useRef(pages);
    const wikiIdRef = useRef(wikiId);
    const currentTeamRef = useRef(currentTeam);
    const channelIdRef = useRef(channelId);
    const autocompleteGroupsRef = useRef(autocompleteGroups);

    // Consolidated ref updates in a single effect
    useEffect(() => {
        channelsRef.current = allChannels;
        teamRef.current = team;
        pagesRef.current = pages;
        wikiIdRef.current = wikiId;
        currentTeamRef.current = currentTeam;
        channelIdRef.current = channelId;
        autocompleteGroupsRef.current = autocompleteGroups;
    }, [allChannels, team, pages, wikiId, currentTeam, channelId, autocompleteGroups]);

    const handleFileUpload = useCallback(async (
        currentEditor: Editor,
        file: File,
        position?: number,
    ) => {
        const validation = validateFile(file, maxFileSize, intl);
        if (!validation.valid) {
            return;
        }

        try {
            await uploadMediaForEditor({
                file,
                channelId: channelId || '',
                onSuccess: (result) => {
                    const fileUrl = `/api/v4/files/${result.fileInfo.id}`;

                    if (isVideoFile(file)) {
                        // Insert video node
                        const videoAttrs = {
                            src: fileUrl,
                            title: file.name,
                        };

                        if (position === undefined) {
                            currentEditor.chain().focus().setVideo(videoAttrs).run();
                        } else {
                            currentEditor.chain().insertContentAt(position, {
                                type: 'video',
                                attrs: videoAttrs,
                            }).focus().run();
                        }
                    } else if (isMediaFile(file)) {
                        // Insert image node
                        const imageAttrs = {
                            src: fileUrl,
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
                    } else {
                        // Insert file attachment node for non-media files
                        const fileAttrs = {
                            fileId: result.fileInfo.id,
                            fileName: result.fileInfo.name,
                            fileSize: result.fileInfo.size,
                            mimeType: result.fileInfo.mime_type,
                            src: fileUrl,
                        };

                        if (position === undefined) {
                            currentEditor.commands.insertFileAttachment(fileAttrs);
                        } else {
                            currentEditor.chain().insertContentAt(position, {
                                type: 'fileAttachment',
                                attrs: fileAttrs,
                            }).focus().run();
                        }
                    }
                },
            }, dispatch);
        } catch {
            // Primary error handling is in uploadMediaForEditor
        }
    }, [maxFileSize, intl, channelId, dispatch]);

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

    // Emoji picker click handler - converts emoji to insertable text
    const handleEmojiClick = useCallback((emoji: Emoji) => {
        const currentEditor = editorRef.current;
        if (!currentEditor) {
            return;
        }

        // Convert emoji to insertable text
        let emojiChar: string;
        if (isSystemEmoji(emoji)) {
            // System emoji: convert unified code to Unicode for WYSIWYG display
            emojiChar = emoji.unified.
                split('-').
                map((code) => String.fromCodePoint(parseInt(code, 16))).
                join('');
        } else {
            // Custom emoji: use shortcode format
            emojiChar = `:${getEmojiName(emoji)}:`;
        }

        currentEditor.chain().focus().insertContent(emojiChar).run();
        setShowEmojiPicker(false);
    }, []);

    // Emoji picker hook integration
    const {emojiPicker, setReference: setEmojiPickerReference} = useEmojiPicker({
        showEmojiPicker,
        setShowEmojiPicker,
        onEmojiClick: handleEmojiClick,
        enableGifPicker: false,
    });

    // Open emoji picker handler for slash command
    const openEmojiPicker = useCallback(() => {
        // Anchor picker to editor element
        if (editorRef.current) {
            setEmojiPickerReference(editorRef.current.view.dom);
        }
        setShowEmojiPicker(true);
    }, [setEmojiPickerReference]);

    const extensions = useMemo(() => {
        const exts = [
            StarterKit.configure({
                heading: false,
                link: false,
            }),
            TextStyle,
            Color,
            Placeholder.configure({
                placeholder,
            }),
            CommentAnchor,
            Link.extend({
                addKeyboardShortcuts() {
                    return {
                        'Mod-l': () => {
                            // Use refs to get current values - avoids stale closures
                            // and removes these from useMemo dependencies
                            const currentPages = pagesRef.current;
                            if (!currentPages) {
                                return false;
                            }
                            const {from, to} = this.editor.state.selection;
                            const text = this.editor.state.doc.textBetween(from, to, '');
                            dispatch(openModal({
                                modalId: ModalIdentifiers.PAGE_LINK,
                                dialogType: PageLinkModal,
                                dialogProps: {
                                    pages: currentPages,
                                    wikiId: wikiIdRef.current || '',
                                    onSelect: (pageId: string, pageTitle: string, pageWikiId: string, linkText: string) => {
                                        const currentEditor = editorRef.current;
                                        if (!currentEditor) {
                                            return;
                                        }
                                        const url = getWikiUrl(currentTeamRef.current?.name || 'team', channelIdRef.current || '', pageWikiId, pageId);
                                        const {from: selFrom, to: selTo} = currentEditor.state.selection;
                                        currentEditor.
                                            chain().
                                            focus().
                                            deleteRange({from: selFrom, to: selTo}).
                                            insertContent({
                                                type: 'text',
                                                text: linkText,
                                                marks: [{type: 'link', attrs: {href: url}}],
                                            }).
                                            command(({tr}) => {
                                                tr.removeStoredMark(currentEditor.schema.marks.link);
                                                return true;
                                            }).
                                            run();
                                    },
                                    onCancel: () => {},
                                    initialLinkText: text,
                                },
                            }));
                            return true;
                        },

                        // Exit link mark when pressing space at the end of a link
                        // This prevents the link from extending to include subsequent text
                        Space: () => {
                            const {selection} = this.editor.state;
                            const {$from} = selection;

                            // Only handle if cursor is at a single point (no selection)
                            if (!selection.empty) {
                                return false;
                            }

                            // Check if we're currently inside a link using isActive (same as bubble menu)
                            if (!this.editor.isActive('link')) {
                                return false;
                            }

                            // Check if there's still link text after the cursor
                            const nodeAfter = $from.nodeAfter;
                            const hasLinkAfter = nodeAfter?.marks.some((m: {type: {name: string}}) => m.type.name === 'link');

                            // If there's no more link text after cursor, we're at the end of the link
                            if (!hasLinkAfter) {
                                // Remove stored link mark so space won't inherit it, then let default handle space
                                this.editor.view.dispatch(
                                    this.editor.view.state.tr.removeStoredMark(this.editor.schema.marks.link),
                                );

                                // Return false to let the default Space handler insert the space
                                return false;
                            }

                            return false;
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

            // Standard Image extension for content compatibility with imports
            // ImageResize only handles 'imageResize' nodes, but imported content uses 'image'
            Image.configure({
                HTMLAttributes: {
                    class: 'wiki-image',
                },
            }),
            Video.configure({
                HTMLAttributes: {
                    class: 'wiki-video',
                },
            }),
            FileAttachment.configure({
                HTMLAttributes: {
                    class: 'wiki-file-attachment',
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
            Callout,
        ];

        if (editable) {
            exts.push(SlashCommandExtension.configure({
                onOpenLinkModal: () => {
                    // Use refs to get current values - avoids stale closures
                    const currentPages = pagesRef.current;
                    if (!currentPages) {
                        return;
                    }
                    dispatch(openModal({
                        modalId: ModalIdentifiers.PAGE_LINK,
                        dialogType: PageLinkModal,
                        dialogProps: {
                            pages: currentPages,
                            wikiId: wikiIdRef.current || '',
                            onSelect: (pageId: string, pageTitle: string, pageWikiId: string, linkText: string) => {
                                const currentEditor = editorRef.current;
                                if (!currentEditor) {
                                    return;
                                }
                                const url = getWikiUrl(currentTeamRef.current?.name || 'team', channelIdRef.current || '', pageWikiId, pageId);
                                const {from: selFrom, to: selTo} = currentEditor.state.selection;
                                currentEditor.
                                    chain().
                                    focus().
                                    deleteRange({from: selFrom, to: selTo}).
                                    insertContent({
                                        type: 'text',
                                        text: linkText,
                                        marks: [{type: 'link', attrs: {href: url}}],
                                    }).
                                    command(({tr}) => {
                                        tr.removeStoredMark(currentEditor.schema.marks.link);
                                        return true;
                                    }).
                                    run();
                            },
                            onCancel: () => {},
                            initialLinkText: '',
                        },
                    }));
                },
                onOpenImageModal: () => {
                    const currentChannelId = channelIdRef.current;
                    if (!currentChannelId || !uploadsEnabled) {
                        dispatch(openModal({
                            modalId: ModalIdentifiers.PAGE_IMAGE_URL,
                            dialogType: TextInputModal,
                            dialogProps: {
                                title: intl.formatMessage({id: 'wiki_editor.image_modal.title', defaultMessage: 'Insert Image'}),
                                placeholder: intl.formatMessage({id: 'wiki_editor.image_modal.placeholder', defaultMessage: 'https://example.com/image.png'}),
                                helpText: intl.formatMessage({id: 'wiki_editor.image_modal.help_text', defaultMessage: 'Enter the URL of the image to insert (must be https://)'}),
                                confirmButtonText: intl.formatMessage({id: 'wiki_editor.image_modal.confirm', defaultMessage: 'Insert'}),
                                cancelButtonText: intl.formatMessage({id: 'wiki_editor.image_modal.cancel', defaultMessage: 'Cancel'}),
                                maxLength: 2048,
                                onConfirm: (url: string) => {
                                    const currentEditor = editorRef.current;
                                    const validatedUrl = validateImageUrl(url);
                                    if (validatedUrl && currentEditor) {
                                        currentEditor.chain().focus().setImage({src: validatedUrl}).run();
                                    }
                                },
                                onCancel: () => {},
                            },
                        }));
                        return;
                    }

                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '*/*';
                    input.multiple = false;

                    input.onchange = async (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        const currentEditor = editorRef.current;
                        if (file && currentEditor) {
                            await handleFileUpload(currentEditor, file);
                        }
                    };

                    input.click();
                },
                onOpenEmojiPicker: openEmojiPicker,
            }));
        }

        // Add custom file paste/drop handler for all file types
        if (editable && uploadsEnabled && channelId) {
            exts.push(
                Extension.create({
                    name: 'filePasteHandler',

                    addProseMirrorPlugins() {
                        const editor = this.editor;

                        return [
                            new Plugin({
                                key: new PluginKey('filePasteHandler'),
                                props: {
                                    handleDOMEvents: {
                                        paste(view, event) {
                                            const items = Array.from(event.clipboardData?.items || []);

                                            // Filter to file items, excluding text/uri-list to prevent auto-downloading URLs
                                            const fileItems = items.filter((item) =>
                                                item.kind === 'file' && item.type !== 'text/uri-list',
                                            );

                                            if (fileItems.length === 0) {
                                                return false;
                                            }

                                            event.preventDefault();
                                            event.stopPropagation();

                                            fileItems.forEach((item) => {
                                                const file = item.getAsFile();
                                                if (file) {
                                                    handleFileUpload(editor, file);
                                                }
                                            });

                                            return true;
                                        },
                                        drop(view, event) {
                                            const files = Array.from(event.dataTransfer?.files || []);

                                            if (files.length === 0) {
                                                return false;
                                            }

                                            event.preventDefault();
                                            event.stopPropagation();

                                            const pos = view.posAtCoords({
                                                left: event.clientX,
                                                top: event.clientY,
                                            });

                                            files.forEach((file) => {
                                                handleFileUpload(
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
            // Note: channelId and autocompleteGroups are passed via refs' current values
            // but since mention suggestions are fetched on-demand via autocomplete callbacks,
            // this doesn't cause stale closure issues - the callbacks use the latest values.
            const mentionChannelId = channelIdRef.current || '';
            const mentionAutocompleteGroups = autocompleteGroupsRef.current;

            exts.push(
                Mention.extend({
                    addOptions() {
                        return {
                            ...(this as any).parent?.(),
                            channelId: mentionChannelId,
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
                        channelId: mentionChannelId,
                        teamId,
                        autocompleteUsersInChannel: handleAutocompleteUsers,
                        searchAssociatedGroupsForReference: handleSearchGroups,
                        autocompleteGroups: mentionAutocompleteGroups,
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
                        const nodeChannelId = node.attrs['data-channel-id'];
                        const channelName = node.attrs.label || node.attrs.id;

                        // Render as a clickable span with cursor pointer
                        return [
                            'span',
                            mergeAttributes(
                                {'data-type': this.name},
                                this.options.HTMLAttributes,
                                HTMLAttributes,
                                {
                                    'data-channel-id': nodeChannelId,
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
                        channelId: mentionChannelId,
                        teamId,
                        autocompleteChannels: handleAutocompleteChannels,
                        delayChannelAutocomplete: false,
                    }) as any,
                }) as any,
            );
        }

        return exts;
    }, [
        placeholder,
        onCreateInlineComment,
        onCommentClick,
        editable,
        uploadsEnabled,
        handleFileUpload,
        currentUserId,
        teamId,
        handleAutocompleteUsers,
        handleSearchGroups,
        handleAutocompleteChannels,
        openEmojiPicker,
        dispatch,
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

    // Full-page proofreading functionality
    const {isProcessing: isProofreading, proofread} = usePageProofread(editor, pageTitle, wikiId || '', pageId, onTranslatedPageCreated, setServerError);

    // Full-page translation functionality
    const {
        isTranslating,
        showModal: showTranslateModal,
        openModal: openTranslateModal,
        closeModal: closeTranslateModal,
        translatePage,
    } = usePageTranslate(editor, pageTitle, wikiId || '', pageId, onTranslatedPageCreated, setServerError);

    // Image AI functionality
    const isVisionEnabled = useVisionCapability();
    const agents = useSelector(getAgents);
    const selectedImageAIAgentId = useMemo(() => {
        if (agents && agents.length > 0) {
            return agents[0].id;
        }
        return null;
    }, [agents]);
    const {
        showExtractionDialog,
        showCompletionDialog,
        actionType: imageActionType,
        progress: imageProgress,
        createdPageTitle: imageCreatedPageTitle,
        handleImageAIAction,
        cancelExtraction,
        goToCreatedPage: goToImageCreatedPage,
        stayOnCurrentPage: stayOnCurrentPageAfterImage,
    } = useImageAI(wikiId || '', pageId, pageTitle, selectedImageAIAgentId, isExistingPage, onTranslatedPageCreated, setServerError);

    // Handler for image AI actions from the bubble menu
    const onImageAIAction = useCallback((action: ImageAIAction, imageElement: HTMLImageElement) => {
        handleImageAIAction(action, imageElement);
    }, [handleImageAIAction]);

    // Expose AI tools handlers to parent component
    useEffect(() => {
        if (!onAIToolsReady) {
            return;
        }

        if (isAIAvailable && editable && editor) {
            onAIToolsReady({
                proofread,
                openTranslateModal,
                isProcessing: isProofreading || isTranslating,
            });
        } else {
            onAIToolsReady(null);
        }
    }, [onAIToolsReady, isAIAvailable, editable, editor, proofread, openTranslateModal, isProofreading, isTranslating]);

    useEffect(() => {
        editorRef.current = editor;

        // Expose editor for E2E testing
        if (editor) {
            window.e2eTiptapEditor = editor;
        }

        return () => {
            editorRef.current = null;
            if (window.e2eTiptapEditor === editor) {
                delete window.e2eTiptapEditor;
            }
        };
    }, [editor]);

    useEffect(() => {
        if (!editor) {
            return;
        }

        // Always update content - let TipTap handle if it's the same
        const contentToSet = getInitialContent(content);
        try {
            editor.commands.setContent(contentToSet);
        } catch (e) {
            // Fallback for severely malformed content (e.g., corrupted tables)
            // eslint-disable-next-line no-console
            console.error('TipTap: Failed to set content, using empty document:', e);
            editor.commands.setContent({type: 'doc', content: []});
        }
    }, [content, editor]);

    useEffect(() => {
        if (editor) {
            editor.setEditable(editable);
        }
    }, [editable, editor]);

    // Pre-fetch users and channels for mentions when editor mounts (consolidated)
    useEffect(() => {
        if (!editable) {
            return;
        }
        if (channelId) {
            dispatch(autocompleteUsersInChannel('', channelId));
        }
        if (teamId) {
            dispatch(autocompleteChannels('', () => {}, () => {}));
        }
    }, [channelId, teamId, editable, dispatch]);

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

        // Convert to Set for O(1) lookups instead of O(n) .includes() in nested loops
        const deletedAnchorSet = new Set(deletedAnchorIds);

        const {tr} = editor.state;
        let hasChanges = false;

        editor.state.doc.descendants((node, pos) => {
            if (node.isText && node.marks.length > 0) {
                node.marks.forEach((mark) => {
                    if (mark.type.name === 'commentAnchor' && deletedAnchorSet.has(mark.attrs.anchorId)) {
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

    // Unified click handler: channel mentions, wiki page links, and images (view mode)
    // Consolidates three separate click handlers into one
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const handleEditorClick = (event: MouseEvent) => {
            const target = event.target as HTMLElement;

            // 1. Handle channel mention clicks
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
                    const teamUrl = window.basename || '';
                    const channelUrl = `${teamUrl}/${currentTeamData.name}/channels/${channel.name}`;
                    history.push(channelUrl);
                    return;
                }
            }

            // 2. Handle link clicks (both wiki-page-links and regular links)
            const linkElement = target.closest('a');
            if (linkElement) {
                if (editable) {
                    // In edit mode, link clicks are handled by mousedown handler above
                    // Just prevent navigation here
                    const href = linkElement.getAttribute('href');
                    if (href) {
                        event.preventDefault();
                    }
                } else {
                    // In view mode, navigate to the linked page
                    const href = linkElement.getAttribute('href');
                    if (href) {
                        // Handle anchor links (e.g., #heading-id) - scroll to the element
                        if (href.startsWith('#')) {
                            event.preventDefault();
                            event.stopPropagation();
                            const targetId = href.substring(1);
                            const targetElement = document.getElementById(targetId);
                            if (targetElement) {
                                targetElement.scrollIntoView({behavior: 'smooth', block: 'start'});
                            }
                            return;
                        }

                        const currentOrigin = window.location.origin;
                        const currentBasename = window.basename || '';
                        const isInternalLink = href.startsWith('/') ||
                            href.startsWith(currentOrigin) ||
                            href.startsWith(currentBasename);

                        if (isInternalLink) {
                            event.preventDefault();
                            event.stopPropagation();
                            const history = getHistory();
                            let relativePath = href;
                            if (href.startsWith(currentOrigin)) {
                                relativePath = href.substring(currentOrigin.length);
                            }
                            if (currentBasename && relativePath.startsWith(currentBasename)) {
                                relativePath = relativePath.substring(currentBasename.length);
                            }
                            history.push(relativePath);
                            return;
                        }
                    }
                }
            }

            // 3. Handle image clicks in view mode only
            if (!editable) {
                let imageElement: HTMLImageElement | null = null;
                if (target instanceof HTMLImageElement) {
                    imageElement = target;
                }
                if (!imageElement) {
                    imageElement = target.closest('img') as HTMLImageElement | null;
                }
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
                        const filename = title || alt;
                        const lastDotIndex = filename.lastIndexOf('.');
                        let extension = 'png';
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
            }
        };

        const editorElement = editor.view.dom;

        // Use mousedown in capture phase for link clicks in edit mode
        // This runs BEFORE ProseMirror processes the click, allowing us to
        // set the cursor inside the link so BubbleMenu's shouldShow sees
        // the correct position.
        const handleLinkMouseDown = (event: MouseEvent) => {
            if (!editable) {
                return; // Only handle in edit mode
            }

            const target = event.target as HTMLElement;
            const linkElement = target.closest('a');
            if (!linkElement) {
                return;
            }

            // Prevent browser navigation
            event.preventDefault();

            // Get the position INSIDE the link (not at boundary)
            const pos = editor.view.posAtDOM(linkElement, 0);
            const insidePos = pos + 1;

            // Set the selection BEFORE ProseMirror processes the click
            editor.chain().
                focus().
                setTextSelection(insidePos).
                run();
        };

        // Add mousedown handler in capture phase (runs before bubble phase)
        editorElement.addEventListener('mousedown', handleLinkMouseDown, true);
        editorElement.addEventListener('click', handleEditorClick);

        return () => {
            editorElement.removeEventListener('mousedown', handleLinkMouseDown, true);
            editorElement.removeEventListener('click', handleEditorClick);
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

    const openPageLinkModal = useCallback((initialText?: string) => {
        if (!pages) {
            return;
        }
        dispatch(openModal({
            modalId: ModalIdentifiers.PAGE_LINK,
            dialogType: PageLinkModal,
            dialogProps: {
                pages,
                wikiId: wikiId || '',
                onSelect: handlePageSelect,
                onCancel: () => {},
                initialLinkText: initialText,
            },
        }));
    }, [dispatch, pages, wikiId, handlePageSelect]);

    const openImageUrlModal = useCallback(() => {
        const currentEditor = editorRef.current;
        dispatch(openModal({
            modalId: ModalIdentifiers.PAGE_IMAGE_URL,
            dialogType: TextInputModal,
            dialogProps: {
                title: intl.formatMessage({id: 'wiki_editor.image_modal.title', defaultMessage: 'Insert Image'}),
                placeholder: intl.formatMessage({id: 'wiki_editor.image_modal.placeholder', defaultMessage: 'https://example.com/image.png'}),
                helpText: intl.formatMessage({id: 'wiki_editor.image_modal.help_text', defaultMessage: 'Enter the URL of the image to insert (must be https://)'}),
                confirmButtonText: intl.formatMessage({id: 'wiki_editor.image_modal.confirm', defaultMessage: 'Insert'}),
                cancelButtonText: intl.formatMessage({id: 'wiki_editor.image_modal.cancel', defaultMessage: 'Cancel'}),
                maxLength: 2048,
                onConfirm: (url: string) => {
                    const validatedUrl = validateImageUrl(url);
                    if (validatedUrl && currentEditor) {
                        currentEditor.chain().focus().setImage({src: validatedUrl}).run();
                    }
                },
                onCancel: () => {},
            },
        }));
    }, [dispatch, intl]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        // Intercept Ctrl+L (or Cmd+L on Mac) to prevent global handler
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            if (editor && pages) {
                e.preventDefault();
                e.stopPropagation();

                const {from, to} = editor.state.selection;
                const text = editor.state.doc.textBetween(from, to, '');
                openPageLinkModal(text);
            }
        }
    }, [editor, pages, openPageLinkModal]);

    if (!editor) {
        return null;
    }

    const setLink = () => {
        const {from, to} = editor.state.selection;
        const text = editor.state.doc.textBetween(from, to, '');
        openPageLinkModal(text);
    };

    const addMedia = () => {
        if (!channelId || !uploadsEnabled) {
            openImageUrlModal();
            return;
        }

        // Create hidden file input (reusing MM pattern)
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '*/*';
        input.multiple = false;

        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file && editor) {
                await handleFileUpload(editor, file);
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
                    <>
                        <FormattingBarBubble
                            editor={editor}
                            uploadsEnabled={uploadsEnabled && Boolean(channelId)}
                            onSetLink={setLink}
                            onAddMedia={addMedia}
                            onAddEmoji={openEmojiPicker}
                            onAddComment={commentHandler}
                            onAIRewrite={aiRewriteHandler}
                        />
                        {emojiPicker}
                    </>
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
            {isAIAvailable && (
                <TranslatePageModal
                    show={showTranslateModal}
                    pageTitle={pageTitle}
                    onClose={closeTranslateModal}
                    onTranslate={translatePage}
                    isTranslating={isTranslating}
                />
            )}
            {editor && editable && isAIAvailable && (
                <ImageAIBubble
                    editor={editor}
                    onImageAIAction={onImageAIAction}
                    visionEnabled={isVisionEnabled}
                />
            )}
            {isAIAvailable && imageActionType && (
                <>
                    <ImageExtractionDialog
                        show={showExtractionDialog}
                        actionType={imageActionType}
                        onCancel={cancelExtraction}
                        progress={imageProgress}
                    />
                    <ImageExtractionCompleteDialog
                        show={showCompletionDialog}
                        actionType={imageActionType}
                        pageTitle={imageCreatedPageTitle}
                        onGoToDraft={goToImageCreatedPage}
                        onStayHere={stayOnCurrentPageAfterImage}
                    />
                </>
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
        prevProps.pageTitle !== nextProps.pageTitle ||
        prevProps.pageParentId !== nextProps.pageParentId ||
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
    if (prevProps.onTranslatedPageCreated !== nextProps.onTranslatedPageCreated) {
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
