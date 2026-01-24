// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import unescape from 'lodash/unescape';
import React, {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import type {Post} from '@mattermost/types/posts';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {getPageComments} from 'actions/pages';
import {getPublishedPages} from 'selectors/pages';

import LoadingScreen from 'components/loading_screen';

import WebSocketClient from 'client/web_websocket_client';
import {SocketEvents} from 'utils/constants';
import {pageInlineCommentHasAnchor} from 'utils/page_utils';
import {getPageTitle} from 'utils/post_utils';

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
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [loading, setLoading] = useState(true);
    const [pageThreads, setPageThreads] = useState<PageThread[]>([]);
    const pages = useSelector((state: GlobalState) => getPublishedPages(state, wikiId));
    const didInitialLoad = useRef(false);
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});

    // Store pages in a ref so fetchAllThreads can access current pages without depending on the array reference
    const pagesRef = useRef(pages);
    pagesRef.current = pages;

    // Create a stable string of page IDs to use as dependency - only changes when actual page set changes
    const pageIds = useMemo(() => pages.map((p) => p.id).sort().join(','), [pages]);

    const fetchAllThreads = useCallback(async () => {
        const currentPages = pagesRef.current;
        if (!currentPages || currentPages.length === 0) {
            setLoading(false);
            return;
        }

        // Only show loading spinner on initial load to prevent DOM detachment during refetch
        if (!didInitialLoad.current) {
            setLoading(true);
        }

        // Fetch all page comments in parallel for better performance
        const results = await Promise.all(
            currentPages.map(async (page) => {
                try {
                    const result = await dispatch(getPageComments(wikiId, page.id));
                    const comments = (result as ActionResult<Post[]>).data || [];
                    const inlineComments = comments.filter((post: Post) => {
                        return pageInlineCommentHasAnchor(post);
                    });

                    if (inlineComments.length > 0) {
                        return {
                            pageId: page.id,
                            pageTitle: getPageTitle(page, untitledText),
                            threadCount: inlineComments.length,
                            threads: inlineComments as Post[],
                        };
                    }
                } catch (error) {
                    // Skip pages that fail to fetch
                }
                return null;
            }),
        );

        // Filter out nulls (pages with no threads or failed fetches)
        const threadsData = results.filter((result): result is PageThread => result !== null);

        setPageThreads(threadsData);
        setLoading(false);
        didInitialLoad.current = true;
    }, [dispatch, wikiId, pageIds, untitledText]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchAllThreads();
    }, [fetchAllThreads]);

    // Listen for WebSocket events for new comments
    useEffect(() => {
        const handleNewComment = (msg: WebSocketMessage) => {
            if (msg.event !== SocketEvents.PAGE_COMMENT_CREATED) {
                return;
            }

            const data = msg.data as {comment: string; page_id: string};
            const post = JSON.parse(data.comment);

            // Check if it's an inline comment for a page in this wiki
            if (pageInlineCommentHasAnchor(post) && post.props?.page_id) {
                fetchAllThreads();
            }
        };

        WebSocketClient.addMessageListener(handleNewComment);

        return () => {
            WebSocketClient.removeMessageListener(handleNewComment);
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
                <p>
                    <FormattedMessage
                        id='wiki.comments.no_threads'
                        defaultMessage='No comment threads in this wiki yet'
                    />
                </p>
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
                            const anchorText = anchor?.text ? unescape(anchor.text) : '';
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
