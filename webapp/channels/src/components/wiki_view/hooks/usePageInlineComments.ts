// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/constants/posts';
import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {openWikiRhs, closeRightHandSide} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import {isDraftPageId} from 'utils/page_utils';
import WebSocketClient from 'client/web_websocket_client';
import {SocketEvents} from 'utils/constants';

import type {GlobalState} from 'types/store';

import {useInlineComments} from './useInlineComments';

/**
 * Shared hook for managing inline comments in both PageViewer and WikiPageEditor.
 * Handles fetching comments, clicking on highlights, creating new comments, and RHS management.
 */
export const usePageInlineComments = (pageId?: string, wikiId?: string) => {
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const page = useSelector((state: GlobalState) => (pageId ? getPost(state, pageId) : undefined));
    const [inlineComments, setInlineComments] = useState<Post[]>([]);
    const [lastClickedCommentId, setLastClickedCommentId] = useState<string | null>(null);

    const isWikiRhsOpen = rhsState === 'wiki';

    // Store fetch logic in a ref to avoid recreating callbacks
    const fetchInlineCommentsRef = useRef<() => Promise<void>>();
    fetchInlineCommentsRef.current = async () => {
        if (!pageId || isDraftPageId(pageId) || !page || !wikiId) {
            return;
        }

        try {
            const comments = await Client4.getPageComments(wikiId, pageId);

            // Filter to only inline comments
            const inline = comments.filter((post: Post) => {
                return post.type === PostTypes.PAGE_COMMENT &&
                       post.props?.comment_type === 'inline' &&
                       post.props?.inline_anchor;
            });

            setInlineComments(inline);
        } catch (error) {
            setInlineComments([]);
        }
    };

    // Stable wrapper that calls the latest version from ref
    const fetchInlineComments = useCallback(async () => {
        await fetchInlineCommentsRef.current?.();
    }, []);

    // Callback when a new inline comment is created
    const handleInlineCommentCreated = useCallback((commentId: string) => {
        // Refresh comments to show the new highlight
        fetchInlineComments();

        // Open RHS focused on the new comment
        if (pageId && wikiId) {
            dispatch(openWikiRhs(pageId, wikiId, commentId));
            setLastClickedCommentId(commentId);
        }
    }, [pageId, wikiId, dispatch, fetchInlineComments]);

    // Use the inline comment modal hook
    const {
        showCommentModal,
        commentAnchor,
        handleCreateInlineComment,
        handleSubmitComment,
        handleCloseModal,
    } = useInlineComments(pageId, wikiId, handleInlineCommentCreated);

    // Fetch comments when pageId changes (only re-run when pageId actually changes, not when fetchInlineComments reference changes)
    useEffect(() => {
        fetchInlineComments();
    }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for WebSocket events for new comments
    useEffect(() => {
        if (!pageId || isDraftPageId(pageId)) {
            return undefined;
        }

        const handleNewPost = (msg: any) => {
            // Only handle POSTED events
            if (msg.event !== SocketEvents.POSTED) {
                return;
            }

            const post = JSON.parse(msg.data.post);

            // Check if it's an inline comment for this page
            if (post.type === PostTypes.PAGE_COMMENT &&
                post.props?.page_id === pageId &&
                post.props?.comment_type === 'inline' &&
                post.props?.inline_anchor) {
                // Add to inline comments list to show the new highlight
                setInlineComments((prev) => [...prev, post]);
            }
        };

        WebSocketClient.addMessageListener(handleNewPost);

        return () => {
            WebSocketClient.removeMessageListener(handleNewPost);
        };
    }, [pageId]);

    // Store the latest callback logic in a ref to avoid closure issues with TipTap
    const handleCommentClickRef = useRef((commentId: string) => {
        if (isWikiRhsOpen && lastClickedCommentId === commentId) {
            dispatch(closeRightHandSide());
            setLastClickedCommentId(null);
            return;
        }

        if (pageId && wikiId) {
            dispatch(openWikiRhs(pageId, wikiId, commentId));
            setLastClickedCommentId(commentId);
        }

        setTimeout(() => {
            const commentElement = document.getElementById(`post_${commentId}`);
            if (commentElement) {
                commentElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                commentElement.classList.add('highlight-animation');
                setTimeout(() => {
                    commentElement.classList.remove('highlight-animation');
                }, 2000);
            }
        }, 300);
    });

    // Update the ref on every render with the latest values
    useEffect(() => {
        handleCommentClickRef.current = (commentId: string) => {
            if (isWikiRhsOpen && lastClickedCommentId === commentId) {
                dispatch(closeRightHandSide());
                setLastClickedCommentId(null);
                return;
            }

            if (pageId && wikiId) {
                dispatch(openWikiRhs(pageId, wikiId, commentId));
                setLastClickedCommentId(commentId);
            }

            setTimeout(() => {
                const commentElement = document.getElementById(`post_${commentId}`);
                if (commentElement) {
                    commentElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                    commentElement.classList.add('highlight-animation');
                    setTimeout(() => {
                        commentElement.classList.remove('highlight-animation');
                    }, 2000);
                } else {
                    // Comment element not found yet, may still be loading
                }
            }, 300);
        };
    }, [isWikiRhsOpen, lastClickedCommentId, pageId, wikiId, dispatch]);

    // Stable callback that always calls the latest version from the ref
    const handleCommentClick = useCallback((commentId: string) => {
        handleCommentClickRef.current(commentId);
    }, []);

    return {
        inlineComments,
        handleCommentClick,
        handleCreateInlineComment,
        showCommentModal,
        commentAnchor,
        handleSubmitComment,
        handleCloseModal,
    };
};
