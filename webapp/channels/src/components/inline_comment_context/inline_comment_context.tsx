// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useCallback} from 'react';
import {useDispatch} from 'react-redux';

import {selectPostById} from 'actions/views/rhs';

import {getHistory} from 'utils/browser_history';

import './inline_comment_context.scss';

type Props = {
    anchorText: string;
    anchorId?: string;
    pageUrl?: string;
    commentPostId?: string;
    onClick?: (e: React.MouseEvent) => void;
    variant?: 'compact' | 'banner';
};

const InlineCommentContext = ({
    anchorText,
    anchorId,
    pageUrl,
    commentPostId,
    onClick,
    variant = 'compact',
}: Props) => {
    const dispatch = useDispatch();

    const handleClick = useCallback((e: React.MouseEvent) => {
        if (onClick) {
            onClick(e);
            return;
        }

        if (pageUrl) {
            e.preventDefault();

            // Extract the path and hash from pageUrl
            const url = new URL(pageUrl, window.location.origin);
            const currentPath = window.location.pathname;

            // Check if we're already on the same page (ignore hash)
            if (url.pathname === currentPath && anchorId) {
                // Already on the page, just scroll to the anchor
                const anchorElement = document.getElementById(`ic-${anchorId}`);
                if (anchorElement) {
                    anchorElement.scrollIntoView({behavior: 'smooth', block: 'center'});

                    // Add highlight animation
                    anchorElement.classList.add('anchor-highlighted');
                    setTimeout(() => {
                        anchorElement.classList.remove('anchor-highlighted');
                    }, 2000);
                    return;
                }
            }

            // Navigate to the page (different page or no anchor)
            getHistory().push(pageUrl);

            if (commentPostId) {
                setTimeout(() => {
                    dispatch(selectPostById(commentPostId));
                }, 100);
            }
        }
    }, [onClick, pageUrl, anchorId, commentPostId, dispatch]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            (e.target as HTMLElement).click();
        }
    }, []);

    const isClickable = Boolean(onClick || pageUrl);

    if (variant === 'banner') {
        return (
            <div
                className={classNames('inline-comment-anchor-banner', {clickable: isClickable})}
                onClick={isClickable ? handleClick : undefined}
                onKeyDown={isClickable ? handleKeyDown : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={isClickable ? `Go to commented text: ${anchorText}` : undefined}
            >
                <i
                    className='icon icon-message-text-outline'
                    style={{marginRight: '6px'}}
                />
                {'Comments on: '}
                <span className='inline-comment-anchor-banner-text'>
                    {'"'}
                    {anchorText}
                    {'"'}
                </span>
                {isClickable && (
                    <i
                        className='icon icon-arrow-right'
                        aria-hidden='true'
                    />
                )}
            </div>
        );
    }

    return (
        <div
            className={classNames('inline-comment-anchor-box', {clickable: isClickable})}
            onClick={isClickable ? handleClick : undefined}
            onKeyDown={isClickable ? handleKeyDown : undefined}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            aria-label={isClickable ? `Go to commented text: ${anchorText}` : undefined}
            data-anchor-id={anchorId}
        >
            <div className='inline-comment-anchor-text'>
                {anchorText || 'TEST TEXT'}
            </div>
            {isClickable && (
                <i
                    className='icon icon-arrow-right'
                    aria-hidden='true'
                />
            )}
        </div>
    );
};

export default InlineCommentContext;
