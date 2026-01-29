// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {EditorState} from '@tiptap/pm/state';
import {NodeSelection, TextSelection} from '@tiptap/pm/state';
import type {Editor} from '@tiptap/react';
import {BubbleMenu} from '@tiptap/react/menus';
import React, {useState, useCallback, useMemo, useEffect, useRef} from 'react';
import {useIntl} from 'react-intl';

import ChevronDownIcon from '@mattermost/compass-icons/components/chevron-down';
import CreationOutlineIcon from '@mattermost/compass-icons/components/creation-outline';
import MessageTextOutlineIcon from '@mattermost/compass-icons/components/message-text-outline';
import PencilOutlineIcon from '@mattermost/compass-icons/components/pencil-outline';

import * as Menu from 'components/menu';
import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import {isUrlSafe} from 'utils/url';

import {FORMATTING_ACTIONS, type FormattingAction} from './formatting_actions';

import './formatting_bar_bubble.scss';
import './ai/image_ai_bubble.scss';

const MAX_LINK_DISPLAY_LENGTH = 40;

export type ImageAIAction = 'extract_handwriting' | 'describe_image';

type Mode = 'link' | 'format' | 'image';

type Props = {
    editor: Editor | null;
    uploadsEnabled: boolean;
    onSetLink: () => void;
    onAddMedia: () => void;
    onAddEmoji?: () => void;
    onAddComment?: (selection: {text: string; from: number; to: number}) => void;
    onAIRewrite?: () => void;
    onImageAIAction?: (action: ImageAIAction, imageElement: HTMLImageElement) => void;
    visionEnabled?: boolean;
};

const FormattingBarBubble = ({editor, uploadsEnabled, onSetLink, onAddMedia, onAddEmoji, onAddComment, onAIRewrite, onImageAIAction, visionEnabled = false}: Props) => {
    const {formatMessage} = useIntl();
    const [mode, setMode] = useState<Mode>('format');
    const [dismissed, setDismissed] = useState(false);
    const [shouldRenderBubble, setShouldRenderBubble] = useState(false);
    const lastSelectionPos = useRef<number | null>(null);
    const capturedImageRef = useRef<HTMLImageElement | null>(null);

    // Listen to editor updates to re-render when selection changes
    // This ensures button active states are updated correctly
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const handleSelectionUpdate = () => {
            const currentPos = editor.state.selection.from;

            // Reset dismissed state when selection position changes significantly
            if (lastSelectionPos.current !== null && Math.abs(currentPos - lastSelectionPos.current) > 1) {
                setDismissed(false);
            }
            lastSelectionPos.current = currentPos;

            // Track whether we have a valid selection that should show the bubble
            const {selection} = editor.state;
            const editorState = editor.state;

            // Check 1: Image selected (with AI available)
            const isNodeSelection = selection instanceof NodeSelection;
            const isImageSelected = onImageAIAction && isNodeSelection &&
                selection.node &&
                (selection.node.type.name === 'image' || selection.node.type.name === 'imageResize');

            // Check 2: Cursor in a link
            const isLinkActive = editor.isActive('link') && selection.empty;

            // Check 3: Text is selected
            const isTextSelection = selection instanceof TextSelection && !selection.empty;
            const hasTextSelected = isTextSelection &&
                editorState.doc.textBetween(selection.from, selection.to).trim().length > 0;

            const shouldShow = Boolean(isImageSelected) || isLinkActive || hasTextSelected;
            setShouldRenderBubble(shouldShow);
        };

        editor.on('selectionUpdate', handleSelectionUpdate);
        editor.on('transaction', handleSelectionUpdate);

        // Run once on mount to set initial state
        handleSelectionUpdate();

        return () => {
            editor.off('selectionUpdate', handleSelectionUpdate);
            editor.off('transaction', handleSelectionUpdate);
        };
    }, [editor, onImageAIAction]);

    // Handle Escape key to dismiss bubble menu
    useEffect(() => {
        if (!editor) {
            return undefined;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setDismissed(true);

                // Change selection to trigger shouldShow re-evaluation
                // This aligns with standard editor behavior where Escape modifies selection
                const {selection} = editor.state;
                if (selection instanceof NodeSelection) {
                    // For image/node selection: move cursor after the node
                    editor.commands.setTextSelection(selection.to);
                } else if (!selection.empty) {
                    // For text selection: collapse to cursor at end of selection
                    editor.commands.setTextSelection(selection.to);
                }
            }
        };

        // Add listener to the editor's DOM element
        const editorElement = editor.view.dom;
        editorElement.addEventListener('keydown', handleKeyDown);

        return () => {
            editorElement.removeEventListener('keydown', handleKeyDown);
        };
    }, [editor]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
    }, []);

    const handleUnlink = useCallback(() => {
        if (!editor) {
            return;
        }
        editor.chain().focus().unsetLink().run();
    }, [editor]);

    const handleOpenLink = useCallback(() => {
        if (!editor) {
            return;
        }
        const href = editor.getAttributes('link').href;
        if (!href || !isUrlSafe(href)) {
            return;
        }

        // Check if this is an internal link (relative URL or same origin)
        const currentOrigin = window.location.origin;
        const currentBasename = window.basename || '';
        const isInternalLink = href.startsWith('/') ||
            href.startsWith(currentOrigin) ||
            (currentBasename && href.startsWith(currentBasename));

        if (isInternalLink) {
            // Navigate within the app using history
            let relativePath = href;
            if (href.startsWith(currentOrigin)) {
                relativePath = href.substring(currentOrigin.length);
            }
            if (currentBasename && relativePath.startsWith(currentBasename)) {
                relativePath = relativePath.substring(currentBasename.length);
            }
            getHistory().push(relativePath);
        } else {
            // External link - open in new tab
            window.open(href, '_blank', 'noopener,noreferrer');
        }
    }, [editor]);

    const handleCopyLink = useCallback(async () => {
        if (!editor) {
            return;
        }
        const href = editor.getAttributes('link').href;
        if (href) {
            try {
                await navigator.clipboard.writeText(href);
            } catch {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = href;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
            }
        }
    }, [editor]);

    const linkUrl = useMemo(() => {
        if (!editor) {
            return '';
        }
        return editor.getAttributes('link').href || '';
    }, [editor]);

    const handleExtractHandwriting = useCallback(() => {
        const imageElement = capturedImageRef.current;
        if (imageElement && onImageAIAction) {
            onImageAIAction('extract_handwriting', imageElement);
        }
    }, [onImageAIAction]);

    const handleDescribeImage = useCallback(() => {
        const imageElement = capturedImageRef.current;
        if (imageElement && onImageAIAction) {
            onImageAIAction('describe_image', imageElement);
        }
    }, [onImageAIAction]);

    // shouldShow callback - this is called with fresh editor state
    // We set mode here to keep React in sync with the current editor state
    const shouldShow = useCallback(({editor: currentEditor, state}: {editor: Editor; state: unknown}) => {
        const editorState = state as EditorState;

        // Don't show if user explicitly dismissed with Escape
        if (dismissed) {
            capturedImageRef.current = null;
            return false;
        }

        const {selection} = editorState;

        // Check for image selection first (NodeSelection on image)
        // Only show image toolbar if AI is available (onImageAIAction provided)
        // Also require editor focus to prevent showing on page load/refresh
        if (onImageAIAction && currentEditor.isFocused && selection instanceof NodeSelection) {
            const {node} = selection;
            if (node && (node.type.name === 'image' || node.type.name === 'imageResize')) {
                // Capture the image element while it's selected
                try {
                    if (currentEditor?.view) {
                        const pos = selection.from;
                        const domNode = currentEditor.view.nodeDOM(pos);

                        if (domNode instanceof HTMLImageElement) {
                            capturedImageRef.current = domNode;
                        } else if (domNode instanceof HTMLElement) {
                            const img = domNode.querySelector('img');
                            capturedImageRef.current = img;
                        }
                    }
                } catch {
                    // View may not be fully mounted yet
                }
                setMode('image');
                return true;
            }
        }

        // Clear captured image when not in image mode
        capturedImageRef.current = null;

        const isLinkActive = currentEditor.isActive('link');
        const isLinkMode = isLinkActive && selection.empty;

        // Update mode state - this schedules a re-render with correct content
        // By the time Tippy displays the menu, React will have rendered the right toolbar
        setMode(isLinkMode ? 'link' : 'format');

        // Show link toolbar when cursor is in a link without selection
        if (isLinkMode) {
            return true;
        }

        // Show formatting toolbar when text is selected
        if (!(selection instanceof TextSelection) || selection.empty) {
            return false;
        }

        const text = editorState.doc.textBetween(selection.from, selection.to).trim();
        return text.length > 0;
    }, [dismissed, onImageAIAction]);

    if (!editor) {
        return null;
    }

    const renderButton = (action: FormattingAction) => {
        if (action.requiresModal) {
            if (action.modalType === 'link') {
                return (
                    <WithTooltip
                        key={action.id}
                        title={action.title}
                    >
                        <button
                            type='button'
                            data-testid='page-link-button'
                            onMouseDown={handleMouseDown}
                            onClick={onSetLink}
                            className={`formatting-btn ${action.isActive?.(editor) ? 'is-active' : ''}`}
                            title={action.title}
                        >
                            <i className={`icon ${action.icon}`}/>
                        </button>
                    </WithTooltip>
                );
            }

            if (action.modalType === 'image' && !uploadsEnabled) {
                return null;
            }

            if (action.modalType === 'image') {
                return (
                    <WithTooltip
                        key={action.id}
                        title={action.title}
                    >
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={onAddMedia}
                            className='formatting-btn'
                            title={action.title}
                        >
                            <i className={`icon ${action.icon}`}/>
                        </button>
                    </WithTooltip>
                );
            }

            if (action.modalType === 'emoji' && onAddEmoji) {
                return (
                    <WithTooltip
                        key={action.id}
                        title={action.title}
                    >
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={onAddEmoji}
                            className='formatting-btn'
                            title={action.title}
                        >
                            <i className={`icon ${action.icon}`}/>
                        </button>
                    </WithTooltip>
                );
            }
        }

        if (action.id === 'table' && editor.isActive('table')) {
            return null;
        }

        return (
            <WithTooltip
                key={action.id}
                title={action.title}
            >
                <button
                    type='button'
                    onMouseDown={handleMouseDown}
                    onClick={() => action.command(editor)}
                    className={`formatting-btn ${action.isActive?.(editor) ? 'is-active' : ''}`}
                    title={action.keyboardShortcut ? `${action.title} (${action.keyboardShortcut})` : action.title}
                >
                    <i className={`icon ${action.icon}`}/>
                </button>
            </WithTooltip>
        );
    };

    const renderDivider = (key: string) => (
        <span
            key={key}
            className='toolbar-divider'
        />
    );

    const buttons: JSX.Element[] = [];
    let lastCategory: string | null = null;

    // Only show actions that make sense for formatting selected text
    const selectionActions = FORMATTING_ACTIONS.filter((action) => action.showForSelection);

    selectionActions.forEach((action) => {
        if (lastCategory && lastCategory !== action.category) {
            buttons.push(renderDivider(`divider-${action.id}`));
        }
        const button = renderButton(action);
        if (button) {
            buttons.push(button);
        }
        lastCategory = action.category;
    });

    // Render link-specific toolbar when cursor is in a link without selection
    const renderLinkToolbar = () => (
        <div
            className='formatting-bar-bubble tiptap-toolbar link-bubble-menu'
            data-testid='link-bubble-menu'
        >
            <div className='link-url-display'>
                <i className='icon icon-link-variant'/>
                <span
                    className='link-url-text'
                    title={linkUrl}
                >
                    {linkUrl.length > MAX_LINK_DISPLAY_LENGTH ? `${linkUrl.substring(0, MAX_LINK_DISPLAY_LENGTH)}...` : linkUrl}
                </span>
            </div>

            <span className='toolbar-divider'/>

            <WithTooltip title={formatMessage({id: 'link_bubble.open', defaultMessage: 'Open link'})}>
                <button
                    type='button'
                    data-testid='link-open-button'
                    onMouseDown={handleMouseDown}
                    onClick={handleOpenLink}
                    className='formatting-btn'
                    aria-label={formatMessage({id: 'link_bubble.open', defaultMessage: 'Open link'})}
                >
                    <i className='icon icon-open-in-new'/>
                </button>
            </WithTooltip>

            <WithTooltip title={formatMessage({id: 'link_bubble.copy', defaultMessage: 'Copy link'})}>
                <button
                    type='button'
                    data-testid='link-copy-button'
                    onMouseDown={handleMouseDown}
                    onClick={handleCopyLink}
                    className='formatting-btn'
                    aria-label={formatMessage({id: 'link_bubble.copy', defaultMessage: 'Copy link'})}
                >
                    <i className='icon icon-content-copy'/>
                </button>
            </WithTooltip>

            <WithTooltip title={formatMessage({id: 'link_bubble.edit', defaultMessage: 'Edit link'})}>
                <button
                    type='button'
                    data-testid='link-edit-button'
                    onMouseDown={handleMouseDown}
                    onClick={onSetLink}
                    className='formatting-btn'
                    aria-label={formatMessage({id: 'link_bubble.edit', defaultMessage: 'Edit link'})}
                >
                    <i className='icon icon-pencil-outline'/>
                </button>
            </WithTooltip>

            <WithTooltip title={formatMessage({id: 'link_bubble.unlink', defaultMessage: 'Remove link'})}>
                <button
                    type='button'
                    data-testid='link-unlink-button'
                    onMouseDown={handleMouseDown}
                    onClick={handleUnlink}
                    className='formatting-btn formatting-btn--danger'
                    aria-label={formatMessage({id: 'link_bubble.unlink', defaultMessage: 'Remove link'})}
                >
                    <i className='icon icon-link-variant-off'/>
                </button>
            </WithTooltip>
        </div>
    );

    // Render standard formatting toolbar
    const renderFormattingToolbar = () => (
        <div className='formatting-bar-bubble tiptap-toolbar'>
            {buttons}

            {editor.isActive('table') && (
                <>
                    <WithTooltip title={formatMessage({id: 'formatting_bar.add_column_before', defaultMessage: 'Add Column Before'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => editor.chain().focus().addColumnBefore().run()}
                            disabled={!editor.can().addColumnBefore()}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.add_column_before', defaultMessage: 'Add Column Before'})}
                        >
                            {'◀|'}
                        </button>
                    </WithTooltip>

                    <WithTooltip title={formatMessage({id: 'formatting_bar.add_column_after', defaultMessage: 'Add Column After'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => editor.chain().focus().addColumnAfter().run()}
                            disabled={!editor.can().addColumnAfter()}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.add_column_after', defaultMessage: 'Add Column After'})}
                        >
                            {'|▶'}
                        </button>
                    </WithTooltip>

                    <WithTooltip title={formatMessage({id: 'formatting_bar.delete_column', defaultMessage: 'Delete Column'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => editor.chain().focus().deleteColumn().run()}
                            disabled={!editor.can().deleteColumn()}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.delete_column', defaultMessage: 'Delete Column'})}
                        >
                            {'⊟|'}
                        </button>
                    </WithTooltip>

                    <WithTooltip title={formatMessage({id: 'formatting_bar.add_row_before', defaultMessage: 'Add Row Before'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => editor.chain().focus().addRowBefore().run()}
                            disabled={!editor.can().addRowBefore()}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.add_row_before', defaultMessage: 'Add Row Before'})}
                        >
                            {'▲═'}
                        </button>
                    </WithTooltip>

                    <WithTooltip title={formatMessage({id: 'formatting_bar.add_row_after', defaultMessage: 'Add Row After'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => editor.chain().focus().addRowAfter().run()}
                            disabled={!editor.can().addRowAfter()}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.add_row_after', defaultMessage: 'Add Row After'})}
                        >
                            {'═▼'}
                        </button>
                    </WithTooltip>

                    <WithTooltip title={formatMessage({id: 'formatting_bar.delete_row', defaultMessage: 'Delete Row'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => editor.chain().focus().deleteRow().run()}
                            disabled={!editor.can().deleteRow()}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.delete_row', defaultMessage: 'Delete Row'})}
                        >
                            {'⊟═'}
                        </button>
                    </WithTooltip>

                    <WithTooltip title={formatMessage({id: 'formatting_bar.delete_table', defaultMessage: 'Delete Table'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => editor.chain().focus().deleteTable().run()}
                            disabled={!editor.can().deleteTable()}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.delete_table', defaultMessage: 'Delete Table'})}
                        >
                            {'🗑'}
                        </button>
                    </WithTooltip>
                </>
            )}

            {onAIRewrite && (
                <>
                    <span className='toolbar-divider'/>
                    <WithTooltip title={formatMessage({id: 'formatting_bar.ai_rewrite', defaultMessage: 'AI Rewrite'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={onAIRewrite}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.ai_rewrite', defaultMessage: 'AI Rewrite'})}
                            title={formatMessage({id: 'formatting_bar.ai_rewrite', defaultMessage: 'AI Rewrite'})}
                            data-testid='ai-rewrite-button'
                        >
                            <i className='icon icon-creation-outline'/>
                        </button>
                    </WithTooltip>
                </>
            )}

            {onAddComment && (
                <>
                    <WithTooltip title={formatMessage({id: 'formatting_bar.add_comment', defaultMessage: 'Add Comment'})}>
                        <button
                            type='button'
                            onMouseDown={handleMouseDown}
                            onClick={() => {
                                const {state} = editor;
                                const {selection} = state;
                                const text = state.doc.textBetween(selection.from, selection.to);

                                onAddComment({
                                    text,
                                    from: selection.from,
                                    to: selection.to,
                                });
                            }}
                            className='formatting-btn'
                            aria-label={formatMessage({id: 'formatting_bar.add_comment', defaultMessage: 'Add Comment'})}
                            title={formatMessage({id: 'formatting_bar.add_comment', defaultMessage: 'Add Comment'})}
                            data-testid='inline-comment-submit'
                        >
                            <i className='icon icon-message-plus-outline'/>
                        </button>
                    </WithTooltip>
                </>
            )}
        </div>
    );

    // Render image AI toolbar when an image is selected
    const renderImageToolbar = () => {
        if (!visionEnabled) {
            return (
                <div
                    className='image-ai-bubble-container'
                    data-testid='image-ai-bubble'
                >
                    <WithTooltip
                        title={formatMessage({
                            id: 'image_ai.vision_not_available',
                            defaultMessage: 'Vision AI is not available. Configure a vision-capable AI model to enable image analysis.',
                        })}
                    >
                        <button
                            type='button'
                            className='image-ai-bubble-button disabled'
                            disabled={true}
                            data-testid='image-ai-menu-button'
                        >
                            <CreationOutlineIcon size={16}/>
                            <span className='image-ai-bubble-button-text'>
                                {formatMessage({id: 'image_ai.button_label', defaultMessage: 'AI'})}
                            </span>
                            <ChevronDownIcon size={12}/>
                        </button>
                    </WithTooltip>
                </div>
            );
        }

        return (
            <div
                className='image-ai-bubble-container'
                data-testid='image-ai-bubble'
            >
                <Menu.Container
                    menu={{
                        id: 'image-ai-bubble-menu',
                        'aria-label': formatMessage({id: 'image_ai.menu_aria_label', defaultMessage: 'Image AI tools'}),
                        width: '220px',
                    }}
                    menuButton={{
                        id: 'image-ai-bubble-button',
                        dataTestId: 'image-ai-menu-button',
                        'aria-label': formatMessage({id: 'image_ai.button_aria_label', defaultMessage: 'Image AI tools'}),
                        class: 'image-ai-bubble-button',
                        children: (
                            <>
                                <CreationOutlineIcon size={16}/>
                                <span className='image-ai-bubble-button-text'>
                                    {formatMessage({id: 'image_ai.button_label', defaultMessage: 'AI'})}
                                </span>
                                <ChevronDownIcon size={12}/>
                            </>
                        ),
                    }}
                    menuHeader={(
                        <div className='image-ai-bubble-menu-header'>
                            {formatMessage({id: 'image_ai.header', defaultMessage: 'IMAGE AI'})}
                        </div>
                    )}
                >
                    <Menu.Item
                        id='extract-handwriting'
                        data-testid='image-ai-extract-handwriting'
                        leadingElement={<PencilOutlineIcon size={18}/>}
                        labels={
                            <span>
                                {formatMessage({id: 'image_ai.extract_handwriting', defaultMessage: 'Extract handwriting'})}
                            </span>
                        }
                        onClick={handleExtractHandwriting}
                    />
                    <Menu.Item
                        id='describe-image'
                        data-testid='image-ai-describe-image'
                        leadingElement={<MessageTextOutlineIcon size={18}/>}
                        labels={
                            <span>
                                {formatMessage({id: 'image_ai.describe_image', defaultMessage: 'Describe image'})}
                            </span>
                        }
                        onClick={handleDescribeImage}
                    />
                </Menu.Container>
            </div>
        );
    };

    const renderToolbar = () => {
        switch (mode) {
        case 'link':
            return renderLinkToolbar();
        case 'image':
            return renderImageToolbar();
        default:
            return renderFormattingToolbar();
        }
    };

    // Don't render BubbleMenu at all when there's nothing valid to show
    if (!shouldRenderBubble) {
        return null;
    }

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={shouldShow}
        >
            {/* key={mode} forces React to unmount/remount when mode changes,
                ensuring Tippy receives the new content */}
            <div key={mode}>
                {renderToolbar()}
            </div>
        </BubbleMenu>
    );
};

export default FormattingBarBubble;
