// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import unescape from 'lodash/unescape';
import React, {useEffect, useState, useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {getPageComments} from 'actions/pages';
import {isPageCommentResolved} from 'selectors/wiki_posts';

import FileUploadOverlay from 'components/file_upload_overlay';
import {DropOverlayIdThreads} from 'components/file_upload_overlay/file_upload_overlay';
import LoadingScreen from 'components/loading_screen';
import Reply from 'components/threading/virtualized_thread_viewer/reply/index';

import WebSocketClient from 'client/web_websocket_client';
import {SocketEvents} from 'utils/constants';
import {pageInlineCommentHasAnchor} from 'utils/page_utils';

import type {FakePost} from 'types/store/rhs';

import {applyResolutionFilter, ResolutionFilterBar} from './resolution_filter';
import WikiReplyComment from './wiki_reply_comment';

import './wiki_page_thread_viewer.scss';

export type Props = {
    isCollapsedThreadsEnabled: boolean;
    userThread?: UserThread | null;
    selected?: Post | FakePost;
    currentUserId: string;
    currentTeamId: string;
    actions: {
        getPageComments: (wikiId: string, pageId: string) => Promise<ActionResult>;
        fetchPage: (pageId: string, wikiId: string) => Promise<ActionResult>;
        updateThreadLastOpened: (threadId: string, lastViewedAt: number) => unknown;
        updateThreadRead: (userId: string, teamId: string, threadId: string, timestamp: number) => unknown;
        updateThreadLastUpdateAt: (threadId: string, lastUpdateAt: number) => unknown;
        openWikiRhs: (pageId: string, wikiId: string, focusedInlineCommentId?: string) => unknown;
    };
    postIds: string[];
    rootPostId: string;
    lastUpdateAt: number;
    hideRootPost?: boolean;
    useRelativeTimestamp?: boolean;
    isThreadView: boolean;
    focusedInlineCommentId: string | null;
    wikiId: string | null;
};

const WikiPageThreadViewer = (props: Props) => {
    const dispatch = useDispatch();
    const intl = useIntl();
    const [isLoading, setIsLoading] = useState(false);
    const [pageComments, setPageComments] = useState<Post[]>([]);
    const [resolutionFilter, setResolutionFilter] = useState<'all' | 'open' | 'resolved'>('open');

    // Extract inline comments from fetched page comments
    const inlineComments = React.useMemo(() => {
        if (props.focusedInlineCommentId) {
            return [];
        }

        const filtered = pageComments.filter((post: Post) => {
            return pageInlineCommentHasAnchor(post);
        }) as Post[];

        return applyResolutionFilter(filtered, resolutionFilter);
    }, [props.focusedInlineCommentId, pageComments, resolutionFilter]);

    useEffect(() => {
        // Clear previous page's comments when navigating to a new page
        setPageComments([]);

        let cancelled = false;

        const fetchData = async () => {
            if (!props.rootPostId || !props.wikiId) {
                if (!cancelled) {
                    setIsLoading(false);
                }
                return;
            }

            setIsLoading(true);

            // For focused inline comment, fetch all page comments so the selector
            // can filter to the focused comment + its replies from commentsByPageId.
            if (props.focusedInlineCommentId) {
                const res = await props.actions.getPageComments(props.wikiId, props.rootPostId);
                if (cancelled) {
                    return;
                }

                const comments = (res as ActionResult<Post[]>).data || [];
                if (comments.length > 0) {
                    const highestUpdateAt = comments.reduce(
                        (max, c) => (c.update_at > max ? c.update_at : max),
                        comments[0].update_at,
                    );
                    props.actions.updateThreadLastUpdateAt(props.focusedInlineCommentId, highestUpdateAt);
                }
            } else {
                // For list view, fetch all page comments
                try {
                    const result = await dispatch(getPageComments(props.wikiId, props.rootPostId));
                    if (cancelled) {
                        return;
                    }
                    const comments = (result as ActionResult<Post[]>).data || [];
                    setPageComments(comments);
                } catch (error) {
                    if (!cancelled) {
                        setPageComments([]);
                    }
                }
            }

            if (!cancelled) {
                setIsLoading(false);
            }
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [props.rootPostId, props.focusedInlineCommentId, props.wikiId, dispatch]);

    // Consolidated WebSocket listener for page comment events
    useEffect(() => {
        if (!props.rootPostId || !props.wikiId) {
            return undefined;
        }

        const handlePageCommentEvents = (msg: WebSocketMessage) => {
            // Handle new page comments (only in list mode)
            if (msg.event === SocketEvents.PAGE_COMMENT_CREATED && !props.focusedInlineCommentId) {
                const data = msg.data as {page_id: string; comment: string};
                const pageId = data.page_id;

                if (pageId !== props.rootPostId) {
                    return;
                }

                const post = JSON.parse(data.comment);

                setPageComments((prev) => {
                    if (prev.some((c) => c.id === post.id)) {
                        return prev;
                    }
                    return [...prev, post];
                });
                return;
            }

            // Handle comment resolution changes
            if (msg.event === SocketEvents.PAGE_COMMENT_RESOLVED || msg.event === SocketEvents.PAGE_COMMENT_UNRESOLVED) {
                const data = msg.data as {comment_id: string; page_id: string; resolved_at?: number; resolved_by?: string};
                const commentId = data.comment_id;
                const pageId = data.page_id;

                if (pageId !== props.rootPostId) {
                    return;
                }

                setPageComments((prev) => {
                    return prev.map((comment) => {
                        if (comment.id === commentId) {
                            const updatedProps = {...comment.props};
                            if (msg.event === SocketEvents.PAGE_COMMENT_RESOLVED) {
                                updatedProps.comment_resolved = true;
                                updatedProps.resolved_at = data.resolved_at;
                                updatedProps.resolved_by = data.resolved_by;
                                updatedProps.resolution_reason = 'manual';
                            } else {
                                delete updatedProps.comment_resolved;
                                delete updatedProps.resolved_at;
                                delete updatedProps.resolved_by;
                                delete updatedProps.resolution_reason;
                            }
                            return {...comment, props: updatedProps};
                        }
                        return comment;
                    });
                });
            }
        };

        WebSocketClient.addMessageListener(handlePageCommentEvents);

        return () => {
            WebSocketClient.removeMessageListener(handlePageCommentEvents);
        };
    }, [props.rootPostId, props.wikiId, props.focusedInlineCommentId, dispatch]);

    useEffect(() => {
        if (props.isCollapsedThreadsEnabled && props.userThread) {
            props.actions.updateThreadLastOpened(
                props.userThread.id,
                props.userThread.last_viewed_at,
            );

            if (
                props.userThread.last_viewed_at < props.userThread.last_reply_at ||
                props.userThread.unread_mentions ||
                props.userThread.unread_replies
            ) {
                props.actions.updateThreadRead(
                    props.currentUserId,
                    props.currentTeamId,
                    props.selected?.id || props.rootPostId,
                    Date.now(),
                );
            }
        }
    }, [props.userThread, props.rootPostId, props.isCollapsedThreadsEnabled, props.currentUserId, props.currentTeamId, props.selected, props.actions]);

    const handleThreadClick = useCallback((threadId: string) => {
        if (props.wikiId && props.rootPostId) {
            props.actions.openWikiRhs(props.rootPostId, props.wikiId, threadId);
        }
    }, [props.wikiId, props.rootPostId, props.actions]);

    // For focused thread view, we need the posts and the page in Redux. The
    // wiki backing channel is not part of the gate because WikiReplyComment
    // submits via the page-comment API, not the channel post API.
    if (props.focusedInlineCommentId && (props.postIds == null || props.selected == null)) {
        return <span/>;
    }

    if (isLoading) {
        return (
            <LoadingScreen
                style={{
                    display: 'grid',
                    placeContent: 'center',
                    flex: '1',
                }}
            />
        );
    }

    // List mode: Show list of inline comment threads
    if (!props.focusedInlineCommentId) {
        return (
            <div className='WikiPageThreadViewer'>
                <ResolutionFilterBar
                    value={resolutionFilter}
                    onChange={setResolutionFilter}
                    ariaLabel={intl.formatMessage({id: 'wiki.comments.filter_label', defaultMessage: 'Filter comments'})}
                />
                {inlineComments.length === 0 ? (
                    <div
                        className='WikiPageThreadViewer__empty'
                        data-testid='wiki-page-thread-viewer-empty'
                    >
                        <i className='icon-comment-outline'/>
                        <p>
                            {resolutionFilter === 'all' ? (
                                <FormattedMessage
                                    id='wiki_thread_viewer.empty.no_threads'
                                    defaultMessage='No comment threads on this page yet'
                                />
                            ) : (
                                <FormattedMessage
                                    id='wiki_thread_viewer.empty.no_comments'
                                    defaultMessage='No {filter} comments'
                                    values={{filter: intl.formatMessage({
                                        id: resolutionFilter === 'open' ? 'wiki.comments.open' : 'wiki.comments.resolved',
                                        defaultMessage: resolutionFilter === 'open' ? 'open' : 'resolved',
                                    })}}
                                />
                            )}
                        </p>
                    </div>
                ) : (
                    <div className='WikiPageThreadViewer__thread-list'>
                        {inlineComments.map((thread) => {
                            const anchor = thread.props?.inline_anchor as {text?: string} | undefined;
                            const anchorText = anchor?.text ? unescape(anchor.text) : '';
                            const truncatedText = anchorText.length > 60 ? `${anchorText.substring(0, 60)}...` : anchorText;
                            const resolved = isPageCommentResolved(thread);

                            return (
                                <button
                                    key={thread.id}
                                    className={`WikiPageThreadViewer__thread-item ${resolved ? 'resolved' : ''}`}
                                    onClick={() => handleThreadClick(thread.id)}
                                    data-testid={`wiki-thread-${thread.id}`}
                                >
                                    <div className='WikiPageThreadViewer__thread-item-icon'>
                                        <i className='icon-message-text-outline'/>
                                    </div>
                                    <div className='WikiPageThreadViewer__thread-item-content'>
                                        <div className='WikiPageThreadViewer__thread-item-text'>
                                            {truncatedText || intl.formatMessage({id: 'wiki_thread_viewer.comment_thread', defaultMessage: 'Comment thread'})}
                                            {resolved && (
                                                <span className='WikiPageThreadViewer__resolved-badge'>
                                                    <i className='icon-check-circle'/>
                                                    <FormattedMessage
                                                        id='wiki_thread_viewer.resolved_badge'
                                                        defaultMessage='Resolved'
                                                    />
                                                </span>
                                            )}
                                        </div>
                                        <div className='WikiPageThreadViewer__thread-item-meta'>
                                            {thread.message && (
                                                <span className='WikiPageThreadViewer__thread-item-preview'>
                                                    {thread.message.length > 80 ? `${thread.message.substring(0, 80)}...` : thread.message}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    // Thread view mode: Show focused thread with replies
    return (
        <div className='WikiPageThreadViewer'>
            <FileUploadOverlay
                overlayType='right'
                id={DropOverlayIdThreads}
            />
            <div className='WikiPageThreadViewer__posts'>
                {props.postIds.map((postId, index) => {
                    const isRootPost = index === 0 && postId === props.focusedInlineCommentId;
                    return (
                        <Reply
                            key={postId}
                            id={postId}
                            a11yIndex={index}
                            isLastPost={index === props.postIds.length - 1}
                            onCardClick={() => {}}
                            previousPostId={index > 0 ? props.postIds[index - 1] : ''}
                            isRootPost={isRootPost}
                            isChannelAutotranslated={false}
                        />
                    );
                })}
            </div>
            <WikiReplyComment pageId={props.rootPostId}/>
        </div>
    );
};

export default WikiPageThreadViewer;
