// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useState, useEffect, useCallback, useRef} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import type {Post} from '@mattermost/types/posts';

import {getPageComments} from 'actions/pages';
import {openWikiRhs, closeRightHandSide} from 'actions/views/rhs';
import {getRhsState} from 'selectors/rhs';

import WebSocketClient from 'client/web_websocket_client';
import {SocketEvents} from 'utils/constants';
import {isDraftPageId, pageInlineCommentHasAnchor} from 'utils/page_utils';

import type {GlobalState} from 'types/store';

import {useInlineComments} from './useInlineComments';

const SCROLL_INTO_VIEW_DELAY_MS = 300;
const HIGHLIGHT_ANIMATION_DURATION_MS = 2000;

/**
 * Shared hook for managing inline comments in both PageViewer and WikiPageEditor.
 * Handles fetching comments, clicking on highlights, creating new comments, and RHS management.
 */
export const usePageInlineComments = (pageId?: string, wikiId?: string) => {
    const dispatch = useDispatch();
    const rhsState = useSelector((state: GlobalState) => getRhsState(state));
    const [inlineComments, setInlineComments] = useState<Post[]>([]);
    const [lastClickedCommentId, setLastClickedCommentId] = useState<string | null>(null);
    const [deletedAnchorIds, setDeletedAnchorIds] = useState<string[]>([]);

    const isWikiRhsOpen = rhsState === 'wiki';

    // Track which pages have had comments loaded to avoid redundant fetches
    const loadedPagesRef = useRef<Set<string>>(new Set());

    // Track timeout IDs for cleanup to prevent memory leaks
    const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const highlightTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Ref to access current inlineComments in event handlers without stale closures
    const inlineCommentsRef = useRef<Post[]>(inlineComments);
    inlineCommentsRef.current = inlineComments;

    // Store fetch logic in a ref to avoid recreating callbacks
    const fetchInlineCommentsRef = useRef<(force?: boolean) => Promise<void>>();
    fetchInlineCommentsRef.current = async (force = false) => {
        if (!pageId || isDraftPageId(pageId) || !wikiId) {
            return;
        }

        // Skip fetch if already loaded for this page (unless force=true)
        if (!force && loadedPagesRef.current.has(pageId)) {
            return;
        }

        try {
            const result = await dispatch(getPageComments(wikiId, pageId));

            if (result.error || !result.data) {
                setInlineComments([]);
                return;
            }

            const comments = result.data;

            // Mark this page as loaded
            loadedPagesRef.current.add(pageId);

            // Filter to only inline comments that are NOT resolved
            const inline = comments.filter((post: Post) => {
                if (!pageInlineCommentHasAnchor(post)) {
                    return false;
                }

                return !post.props?.comment_resolved;
            });

            setInlineComments(inline);
        } catch (error) {
            setInlineComments([]);
        }
    };

    // Stable wrapper that calls the latest version from ref
    const fetchInlineComments = useCallback(async (force = false) => {
        await fetchInlineCommentsRef.current?.(force);
    }, []);

    // Use the inline comment hook (opens RHS instead of modal)
    const {
        handleCreateInlineComment,
    } = useInlineComments(pageId, wikiId);

    // Fetch comments when pageId changes (only re-run when pageId actually changes, not when fetchInlineComments reference changes)
    useEffect(() => {
        fetchInlineComments();
    }, [pageId]); // eslint-disable-line react-hooks/exhaustive-deps

    // Listen for WebSocket events for new comments
    useEffect(() => {
        if (!pageId || isDraftPageId(pageId)) {
            return undefined;
        }

        const handleNewComment = (msg: WebSocketMessage) => {
            if (msg.event !== SocketEvents.PAGE_COMMENT_CREATED) {
                return;
            }

            const data = msg.data as {page_id: string; comment: string};
            if (data.page_id !== pageId) {
                return;
            }

            const post = JSON.parse(data.comment);

            // Only add if it's an inline comment and not resolved (Confluence behavior: no highlight for resolved comments)
            if (pageInlineCommentHasAnchor(post) && !post.props?.comment_resolved) {
                setInlineComments((prev) => [...prev, post]);
            }
        };

        WebSocketClient.addMessageListener(handleNewComment);

        return () => {
            WebSocketClient.removeMessageListener(handleNewComment);
        };
    }, [pageId]);

    // Listen for WebSocket events that should remove inline comment highlights
    // This handles: resolution, unresolve, and deletion
    useEffect(() => {
        if (!pageId || isDraftPageId(pageId)) {
            return undefined;
        }

        const handleCommentUpdate = (msg: WebSocketMessage) => {
            const data = msg.data as {comment_id?: string; page_id?: string} | undefined;

            // Handle comment resolution - removes highlight
            if (msg.event === SocketEvents.PAGE_COMMENT_RESOLVED) {
                const commentId = data?.comment_id;
                const eventPageId = data?.page_id;

                if (commentId && eventPageId === pageId) {
                    setInlineComments((prev) => prev.filter((comment) => comment.id !== commentId));
                }
                return;
            }

            // Handle comment unresolve - adds highlight back
            if (msg.event === SocketEvents.PAGE_COMMENT_UNRESOLVED) {
                const eventPageId = data?.page_id;

                if (eventPageId === pageId) {
                    fetchInlineComments(true);
                }
                return;
            }

            // Handle comment deletion - removes highlight and mark
            if (msg.event === SocketEvents.PAGE_COMMENT_DELETED) {
                const commentId = data?.comment_id;
                const eventPageId = data?.page_id;

                if (commentId && eventPageId === pageId) {
                    // Find the anchor ID from the ref (synchronous access to current state)
                    const deletedComment = inlineCommentsRef.current.find((comment) => comment.id === commentId);
                    const inlineAnchor = deletedComment?.props?.inline_anchor as {anchor_id?: string} | undefined;
                    const anchorId = inlineAnchor?.anchor_id;

                    // Track the anchor ID so the editor can remove the mark
                    if (anchorId) {
                        setDeletedAnchorIds((ids) => [...ids, anchorId]);
                    }

                    // Remove the comment from state
                    setInlineComments((prev) => prev.filter((comment) => comment.id !== commentId));
                }
            }
        };

        WebSocketClient.addMessageListener(handleCommentUpdate);

        return () => {
            WebSocketClient.removeMessageListener(handleCommentUpdate);
        };
    }, [pageId, fetchInlineComments]);

    // Store the latest callback logic in a ref to avoid closure issues with TipTap
    // Initialize with a no-op to avoid stale closure on first render
    const handleCommentClickRef = useRef<(commentId: string) => void>(() => {});

    // Update the ref on every render with the latest values
    useEffect(() => {
        handleCommentClickRef.current = (commentId: string) => {
            // Clear any pending timeouts to prevent stale operations
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }

            if (isWikiRhsOpen && lastClickedCommentId === commentId) {
                dispatch(closeRightHandSide());
                setLastClickedCommentId(null);
                return;
            }

            if (pageId && wikiId) {
                dispatch(openWikiRhs(pageId, wikiId, commentId));
                setLastClickedCommentId(commentId);
            }

            scrollTimeoutRef.current = setTimeout(() => {
                const commentElement = document.getElementById(`post_${commentId}`);
                if (commentElement) {
                    commentElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                    commentElement.classList.add('highlight-animation');
                    highlightTimeoutRef.current = setTimeout(() => {
                        commentElement.classList.remove('highlight-animation');
                    }, HIGHLIGHT_ANIMATION_DURATION_MS);
                }
            }, SCROLL_INTO_VIEW_DELAY_MS);
        };
    }, [isWikiRhsOpen, lastClickedCommentId, pageId, wikiId, dispatch]);

    // Cleanup timeouts on unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
            }
        };
    }, []);

    // Stable callback that always calls the latest version from the ref
    const handleCommentClick = useCallback((commentId: string) => {
        handleCommentClickRef.current(commentId);
    }, []);

    // Clear deleted anchor IDs after they've been processed by the editor
    const clearDeletedAnchorIds = useCallback(() => {
        setDeletedAnchorIds([]);
    }, []);

    return {
        inlineComments,
        handleCommentClick,
        handleCreateInlineComment,
        deletedAnchorIds,
        clearDeletedAnchorIds,
    };
};
