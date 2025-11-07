// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useState, useCallback} from 'react';
import {useSelector} from 'react-redux';

import type {Post} from '@mattermost/types/posts';

import {Client4} from 'mattermost-redux/client';
import {PostTypes} from 'mattermost-redux/constants/posts';

import {getPages} from 'selectors/pages';

import LoadingScreen from 'components/loading_screen';

import {isDraftPageId} from 'utils/page_utils';
import WebSocketClient from 'client/web_websocket_client';
import {SocketEvents} from 'utils/constants';

import type {GlobalState} from 'types/store';

type PageThread = {
    pageId: string;
    pageTitle: string;
    threadCount: number;
    threads: Post[];
};

type Props = {
    wikiId: string;
    onThreadClick: (pageId: string, threadId: string) => void;
};

const AllWikiThreads = ({wikiId, onThreadClick}: Props) => {
    const [loading, setLoading] = useState(true);
    const [pageThreads, setPageThreads] = useState<PageThread[]>([]);
    const pages = useSelector((state: GlobalState) => getPages(state, wikiId));

    const fetchAllThreads = useCallback(async () => {
        if (!pages || pages.length === 0) {
            setLoading(false);
            return;
        }

        setLoading(true);

        const threadsData: PageThread[] = [];

        // eslint-disable-next-line no-await-in-loop
        for (const page of pages) {
            if (isDraftPageId(page.id)) {
                continue;
            }

            try {
                // Use getPageComments instead of getPostThread to get inline comments
                // eslint-disable-next-line no-await-in-loop
                const comments = await Client4.getPageComments(wikiId, page.id);

                const inlineComments = comments.filter((post: Post) => {
                    return post.type === PostTypes.PAGE_COMMENT &&
                               post.props?.comment_type === 'inline' &&
                               post.props?.inline_anchor;
                });

                if (inlineComments.length > 0) {
                    threadsData.push({
                        pageId: page.id,
                        pageTitle: (page.props?.title as string) || 'Untitled',
                        threadCount: inlineComments.length,
                        threads: inlineComments as Post[],
                    });
                }
            } catch (error) {
                // Skip pages that fail to fetch
            }
        }

        setPageThreads(threadsData);
        setLoading(false);
    }, [pages, wikiId]);

    useEffect(() => {
        fetchAllThreads();
    }, [fetchAllThreads]);

    // Listen for WebSocket events for new comments
    useEffect(() => {
        const handleNewPost = (msg: any) => {
            // Only handle POSTED events
            if (msg.event !== SocketEvents.POSTED) {
                return;
            }

            const post = JSON.parse(msg.data.post);

            // Check if it's an inline comment
            if (post.type === PostTypes.PAGE_COMMENT &&
                post.props?.comment_type === 'inline' &&
                post.props?.inline_anchor &&
                post.props?.page_id) {
                // Refetch all threads to include the new comment
                fetchAllThreads();
            }
        };

        WebSocketClient.addMessageListener(handleNewPost);

        return () => {
            WebSocketClient.removeMessageListener(handleNewPost);
        };
    }, [fetchAllThreads]);

    if (loading) {
        return (
            <div className='WikiRHS__all-threads-loading'>
                <LoadingScreen/>
            </div>
        );
    }

    if (pageThreads.length === 0) {
        return (
            <div
                className='WikiRHS__empty-state'
                data-testid='wiki-rhs-all-threads-empty'
            >
                <i className='icon-comment-outline'/>
                <p>{'No comment threads in this wiki yet'}</p>
            </div>
        );
    }

    return (
        <div
            className='WikiRHS__all-threads'
            data-testid='wiki-rhs-all-threads'
        >
            {pageThreads.map((pageThread) => (
                <div
                    key={pageThread.pageId}
                    className='WikiRHS__page-thread-group'
                >
                    <div className='WikiRHS__page-thread-header'>
                        <i className='icon-file-document-outline'/>
                        <span className='WikiRHS__page-thread-title'>
                            {pageThread.pageTitle}
                        </span>
                        <span className='WikiRHS__page-thread-count'>
                            {`${pageThread.threadCount} ${pageThread.threadCount === 1 ? 'thread' : 'threads'}`}
                        </span>
                    </div>
                    <div className='WikiRHS__page-threads-list'>
                        {pageThread.threads.map((thread) => {
                            const anchor = thread.props?.inline_anchor as {text?: string} | undefined;
                            const anchorText = anchor?.text || '';
                            const truncatedText = anchorText.length > 60 ? `${anchorText.substring(0, 60)}...` : anchorText;

                            return (
                                <button
                                    key={thread.id}
                                    className='WikiRHS__thread-item'
                                    onClick={() => onThreadClick(pageThread.pageId, thread.id)}
                                    data-testid={`wiki-rhs-thread-${thread.id}`}
                                >
                                    <div className='WikiRHS__thread-item-icon'>
                                        <i className='icon-message-text-outline'/>
                                    </div>
                                    <div className='WikiRHS__thread-item-content'>
                                        <div className='WikiRHS__thread-item-text'>
                                            {truncatedText || 'Comment thread'}
                                        </div>
                                        <div className='WikiRHS__thread-item-meta'>
                                            {thread.message && (
                                                <span className='WikiRHS__thread-item-preview'>
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
            ))}
        </div>
    );
};

export default AllWikiThreads;
