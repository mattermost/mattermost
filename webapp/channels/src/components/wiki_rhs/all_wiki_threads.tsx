// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import unescape from 'lodash/unescape';
import React, {useEffect, useState, useCallback, useRef, useMemo} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import type {WebSocketMessage} from '@mattermost/client';
import type {Post} from '@mattermost/types/posts';

import type {ActionResult} from 'mattermost-redux/types/actions';

import {logError} from 'mattermost-redux/actions/errors';

import {getPageComments, fetchPages} from 'actions/pages';
import {makeGetPublishedPages, arePagesLoaded} from 'selectors/pages';

import LoadingScreen from 'components/loading_screen';

import WebSocketClient from 'client/web_websocket_client';
import {useIsMounted} from 'hooks/useIsMounted';
import {SocketEvents} from 'utils/constants';
import {pageInlineCommentHasAnchor, getPageTitle} from 'utils/page_utils';
import {applyResolutionFilter, ResolutionFilterBar} from './resolution_filter';

import type {GlobalState} from 'types/store';

type PageThread = {
    pageId: string;
    pageTitle: string;
    threadCount: number;
    threads: Post[];
};

type Props = {
    wikiId: string;
    onThreadClick: (pageId: string, threadId: string, anchorId?: string) => void;
};

const AllWikiThreads = ({wikiId, onThreadClick}: Props) => {
    const dispatch = useDispatch();
    const {formatMessage} = useIntl();
    const [loading, setLoading] = useState(true);
    const [fetchingPages, setFetchingPages] = useState(true);
    const [resolutionFilter, setResolutionFilter] = useState<'all' | 'open' | 'resolved'>('open');
    const [fetchPagesError, setFetchPagesError] = useState<string | false>(false);
    const [pageThreads, setPageThreads] = useState<PageThread[]>([]);
    const getPublishedPages = useMemo(() => makeGetPublishedPages(), []);
    const pages = useSelector((state: GlobalState) => getPublishedPages(state, wikiId));
    const loaded = useSelector((state: GlobalState) => arePagesLoaded(state, wikiId));
    const didInitialLoad = useRef(false);
    const isMounted = useIsMounted();
    const untitledText = formatMessage({id: 'wiki.untitled_page', defaultMessage: 'Untitled'});
    const fetchingPagesRef = useRef(false);

    // Store pages in a ref so fetchAllThreads can access current pages without depending on the array reference
    const pagesRef = useRef(pages);
    pagesRef.current = pages;

    // Create a stable string of page IDs to use as dependency - only changes when actual page set changes
    const pageIds = useMemo(() => pages.map((p) => p.id).sort().join(','), [pages]);

    // filteredPageThreads must be declared before any early returns to satisfy Rules of Hooks
    const filteredPageThreads = useMemo(() => {
        return pageThreads.map((pageThread) => {
            const filtered = applyResolutionFilter(pageThread.threads, resolutionFilter);
            return {...pageThread, threads: filtered, threadCount: filtered.length};
        }).filter((pageThread) => pageThread.threads.length > 0);
    }, [pageThreads, resolutionFilter]);

    useEffect(() => {
        if (loaded) {
            setFetchingPages(false);
            return;
        }

        // Guard against concurrent dispatches; skip retry only for the same wiki that errored.
        if (fetchingPagesRef.current || fetchPagesError === wikiId) {
            return;
        }

        // Capture wikiId at dispatch time so a late resolution from a previous
        // wiki cannot poison state for the current one (sets error/loading
        // against the wrong wiki).
        const requestedWikiId = wikiId;
        fetchingPagesRef.current = true;
        dispatch(fetchPages(wikiId)).
            catch((err) => {
                if (isMounted() && requestedWikiId === wikiId) {
                    dispatch(logError(err));
                    setFetchPagesError(requestedWikiId);
                }
            }).
            finally(() => {
                fetchingPagesRef.current = false;
                if (isMounted() && requestedWikiId === wikiId) {
                    setFetchingPages(false);
                }
            });
    }, [dispatch, wikiId, loaded, isMounted, fetchPagesError]);

    const fetchAllThreads = useCallback(async () => {
        if (fetchingPages) {
            return;
        }
        const currentPages = pagesRef.current;
        if (!currentPages || currentPages.length === 0) {
            if (isMounted()) {
                setLoading(false);
            }
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

        if (!isMounted()) {
            return;
        }

        // Filter out nulls (pages with no threads or failed fetches)
        const threadsData = results.filter((result): result is PageThread => result !== null);

        setPageThreads(threadsData);
        setLoading(false);
        didInitialLoad.current = true;
    }, [dispatch, wikiId, pageIds, untitledText, isMounted, fetchingPages]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetchAllThreads();
    }, [fetchAllThreads]);

    // Store fetchAllThreads in a ref to avoid stale closures in the WebSocket listener
    const fetchAllThreadsRef = useRef(fetchAllThreads);
    fetchAllThreadsRef.current = fetchAllThreads;

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
                fetchAllThreadsRef.current();
            }
        };

        WebSocketClient.addMessageListener(handleNewComment);

        return () => {
            WebSocketClient.removeMessageListener(handleNewComment);
        };
    }, []);

    if (fetchPagesError === wikiId) {
        return (
            <div className='WikiRHS__empty-state'>
                <FormattedMessage
                    id='wiki.comments.load_error'
                    defaultMessage='Failed to load threads. Refresh the page to try again.'
                />
            </div>
        );
    }

    if (loading || fetchingPages) {
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
            <ResolutionFilterBar
                value={resolutionFilter}
                onChange={setResolutionFilter}
                ariaLabel={formatMessage({id: 'wiki.comments.filter_label', defaultMessage: 'Filter threads'})}
            />
            {filteredPageThreads.length === 0 && (
                <div
                    className='WikiRHS__empty-state'
                    data-testid='wiki-rhs-all-threads-empty'
                >
                    <i className='icon-comment-outline'/>
                    <p>
                        <FormattedMessage
                            id='wiki.comments.no_threads_for_filter'
                            defaultMessage='No threads match the current filter'
                        />
                    </p>
                </div>
            )}
            {filteredPageThreads.map((pageThread) => (
                <div
                    key={pageThread.pageId}
                    className='WikiRHS__page-thread-group'
                >
                    <div className='WikiRHS__page-thread-header'>
                        <i
                            className='icon-file-document-outline'
                            aria-hidden='true'
                        />
                        <span className='WikiRHS__page-thread-title'>
                            {pageThread.pageTitle}
                        </span>
                        <span className='WikiRHS__page-thread-count'>
                            {formatMessage(
                                {id: 'wiki_rhs.thread_count', defaultMessage: '{count, plural, one {# thread} other {# threads}}'},
                                {count: pageThread.threadCount},
                            )}
                        </span>
                    </div>
                    <div className='WikiRHS__page-threads-list'>
                        {pageThread.threads.map((thread) => {
                            const anchor = thread.props?.inline_anchor as {text?: string} | undefined;
                            const anchorText = anchor?.text ? unescape(anchor.text) : '';
                            const truncatedText = anchorText.length > 60 ? `${anchorText.substring(0, 60)}...` : anchorText;

                            const accessibleLabel = formatMessage(
                                {id: 'wiki_rhs.thread_item.aria_label', defaultMessage: 'Open thread on {pageTitle}: {preview}'},
                                {
                                    pageTitle: pageThread.pageTitle,
                                    preview: truncatedText || formatMessage({id: 'wiki_rhs.comment_thread_fallback', defaultMessage: 'Comment thread'}),
                                },
                            );
                            return (
                                <button
                                    key={thread.id}
                                    className='WikiRHS__thread-item'
                                    onClick={() => onThreadClick(pageThread.pageId, thread.id, (thread.props?.inline_anchor as {id?: string} | undefined)?.id)}
                                    data-testid={`wiki-rhs-thread-${thread.id}`}
                                    aria-label={accessibleLabel}
                                >
                                    <div className='WikiRHS__thread-item-icon'>
                                        <i
                                            className='icon-message-text-outline'
                                            aria-hidden='true'
                                        />
                                    </div>
                                    <div className='WikiRHS__thread-item-content'>
                                        <div className='WikiRHS__thread-item-text'>
                                            {truncatedText || formatMessage({id: 'wiki_rhs.comment_thread_fallback', defaultMessage: 'Comment thread'})}
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
