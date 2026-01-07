// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {Editor} from '@tiptap/react';
import {BubbleMenu} from '@tiptap/react/menus';
import React, {useCallback, useMemo} from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import {getHistory} from 'utils/browser_history';
import {isUrlSafe} from 'utils/url';

import './link_bubble_menu.scss';

const MAX_LINK_DISPLAY_LENGTH = 40;

type Props = {
    editor: Editor | null;
    onEditLink: () => void;
};

const LinkBubbleMenu = ({editor, onEditLink}: Props) => {
    const {formatMessage} = useIntl();

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

    if (!editor) {
        return null;
    }

    return (
        <BubbleMenu
            editor={editor}
            shouldShow={({editor: currentEditor}) => {
                // Show when cursor is on a link but NO text is selected
                const {selection} = currentEditor.state;
                const isLinkActive = currentEditor.isActive('link');
                const hasSelection = !selection.empty;

                // Only show link bubble when on a link and no selection
                // (FormattingBarBubble handles selection case)
                return isLinkActive && !hasSelection;
            }}
        >
            <div
                className='link-bubble-menu'
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

                <span className='link-divider'/>

                <WithTooltip title={formatMessage({id: 'link_bubble.open', defaultMessage: 'Open link'})}>
                    <button
                        type='button'
                        data-testid='link-open-button'
                        onMouseDown={handleMouseDown}
                        onClick={handleOpenLink}
                        className='link-action-btn'
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
                        className='link-action-btn'
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
                        onClick={onEditLink}
                        className='link-action-btn'
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
                        className='link-action-btn link-action-btn--danger'
                        aria-label={formatMessage({id: 'link_bubble.unlink', defaultMessage: 'Remove link'})}
                    >
                        <i className='icon icon-link-variant-off'/>
                    </button>
                </WithTooltip>
            </div>
        </BubbleMenu>
    );
};

export default LinkBubbleMenu;
