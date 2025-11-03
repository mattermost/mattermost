// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback} from 'react';
import {useSelector} from 'react-redux';

import type {Channel} from '@mattermost/types/channels';
import type {Post} from '@mattermost/types/posts';
import type {UserThread} from '@mattermost/types/threads';

import {PostTypes} from 'mattermost-redux/constants/posts';
import type {ActionResult} from 'mattermost-redux/types/actions';

import FileUploadOverlay from 'components/file_upload_overlay';
import {DropOverlayIdThreads} from 'components/file_upload_overlay/file_upload_overlay';
import LoadingScreen from 'components/loading_screen';
import CreateComment from 'components/threading/virtualized_thread_viewer/create_comment';
import Reply from 'components/threading/virtualized_thread_viewer/reply/index';

import type {GlobalState} from 'types/store';
import type {FakePost} from 'types/store/rhs';

import './wiki_page_thread_viewer.scss';

export type Props = {
    isCollapsedThreadsEnabled: boolean;
    userThread?: UserThread | null;
    channel?: Channel;
    selected?: Post | FakePost;
    currentUserId: string;
    currentTeamId: string;
    actions: {
        getPostThread: (rootId: string, fetchThreads: boolean, lastUpdateAt: number) => Promise<ActionResult>;
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
    const [isLoading, setIsLoading] = useState(false);

    const allPosts = useSelector((state: GlobalState) => state.entities.posts.posts);
    const postsInThread = useSelector((state: GlobalState) =>
        state.entities.posts.postsInThread[props.rootPostId] || [],
    );

    // Extract inline comments from Redux - always use latest data from Redux
    const inlineComments = React.useMemo(() => {
        if (props.focusedInlineCommentId) {
            return [];
        }
        return postsInThread.
            map((postId) => allPosts[postId]).
            filter(Boolean).
            filter((post: Post) => {
                return post.type === PostTypes.PAGE_COMMENT &&
                       post.props?.comment_type === 'inline' &&
                       post.props?.inline_anchor;
            }) as Post[];
    }, [props.focusedInlineCommentId, postsInThread, allPosts]);

    useEffect(() => {
        const fetchData = async () => {
            if (!props.selected) {
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            const res = await props.actions.getPostThread(props.rootPostId, true, props.lastUpdateAt);

            if (props.selected && res.data) {
                const {order, posts} = res.data;
                if (order.length > 0 && posts[order[0]]) {
                    let highestUpdateAt = posts[order[0]].update_at;

                    for (const postId in posts) {
                        if (Object.hasOwn(posts, postId)) {
                            const post = posts[postId];
                            if (post.update_at > highestUpdateAt) {
                                highestUpdateAt = post.update_at;
                            }
                        }
                    }

                    props.actions.updateThreadLastUpdateAt(props.selected.id, highestUpdateAt);
                }
            }

            setIsLoading(false);
        };

        fetchData();
    }, [props.rootPostId, props.focusedInlineCommentId]);

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
    }, [props.userThread, props.rootPostId]);

    const handleThreadClick = useCallback((threadId: string) => {
        if (props.wikiId && props.rootPostId) {
            props.actions.openWikiRhs(props.rootPostId, props.wikiId, threadId);
        }
    }, [props.wikiId, props.rootPostId, props.actions]);

    if (props.postIds == null || props.selected == null || !props.channel) {
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
        if (inlineComments.length === 0) {
            return (
                <div
                    className='WikiPageThreadViewer__empty'
                    data-testid='wiki-page-thread-viewer-empty'
                >
                    <i className='icon-comment-outline'/>
                    <p>{'No comment threads on this page yet'}</p>
                </div>
            );
        }

        return (
            <div className='WikiPageThreadViewer'>
                <div className='WikiPageThreadViewer__thread-list'>
                    {inlineComments.map((thread) => {
                        const anchor = thread.props?.inline_anchor as {text?: string} | undefined;
                        const anchorText = anchor?.text || '';
                        const truncatedText = anchorText.length > 60 ? `${anchorText.substring(0, 60)}...` : anchorText;

                        return (
                            <button
                                key={thread.id}
                                className='WikiPageThreadViewer__thread-item'
                                onClick={() => handleThreadClick(thread.id)}
                                data-testid={`wiki-thread-${thread.id}`}
                            >
                                <div className='WikiPageThreadViewer__thread-item-icon'>
                                    <i className='icon-message-text-outline'/>
                                </div>
                                <div className='WikiPageThreadViewer__thread-item-content'>
                                    <div className='WikiPageThreadViewer__thread-item-text'>
                                        {truncatedText || 'Comment thread'}
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
            </div>
        );
    }

    // Thread view mode: Show focused thread with replies
    const focusedComment = props.focusedInlineCommentId ? allPosts[props.focusedInlineCommentId] : null;
    const anchorText = (focusedComment?.props?.inline_anchor as {text?: string} | undefined)?.text || 'Comment thread';

    return (
        <div className='WikiPageThreadViewer'>
            <FileUploadOverlay
                overlayType='right'
                id={DropOverlayIdThreads}
            />
            <div className='WikiPageThreadViewer__thread-header'>
                <h3 className='WikiPageThreadViewer__thread-title'>{anchorText}</h3>
            </div>
            <div className='WikiPageThreadViewer__posts'>
                {props.postIds.map((postId, index) => (
                    <Reply
                        key={postId}
                        id={postId}
                        currentUserId={props.currentUserId}
                        a11yIndex={index}
                        isLastPost={index === props.postIds.length - 1}
                        onCardClick={() => {}}
                        previousPostId={index > 0 ? props.postIds[index - 1] : ''}
                    />
                ))}
            </div>
            <CreateComment
                isThreadView={props.isThreadView}
                threadId={props.focusedInlineCommentId || props.selected.id}
            />
        </div>
    );
};

export default WikiPageThreadViewer;
