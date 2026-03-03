// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';

import type {Post} from '@mattermost/types/posts';

import Tab from 'components/tabs/tab';
import Tabs from 'components/tabs/tabs';
import WithTooltip from 'components/with_tooltip';

import type {InlineAnchor} from 'types/store/pages';

import AllWikiThreads from './all_wiki_threads';
import WikiNewCommentView from './wiki_new_comment_view';
import WikiThreadViewer from './wiki_thread_viewer_container';

import './wiki_rhs.scss';

type Props = {
    pageId: string | null;
    wikiId: string | null;
    pageTitle: string;
    channelLoaded: boolean;
    activeTab: 'page_comments' | 'all_threads';
    focusedInlineCommentId: string | null;
    pendingInlineAnchor: InlineAnchor | null;
    isExpanded: boolean;
    isSubmittingComment: boolean;
    actions: {
        publishPage: (wikiId: string, pageId: string) => Promise<{data?: Post; error?: Error}>;
        closeRightHandSide: () => void;
        setWikiRhsActiveTab: (tab: 'page_comments' | 'all_threads') => void;
        setFocusedInlineCommentId: (commentId: string | null) => void;
        setPendingInlineAnchor: (anchor: InlineAnchor | null) => void;
        openWikiRhs: (pageId: string, wikiId: string, focusedInlineCommentId?: string) => void;
        toggleRhsExpanded: () => void;
    };
};

const WikiRHS = ({pageId, wikiId, pageTitle, channelLoaded, activeTab, focusedInlineCommentId, pendingInlineAnchor, isExpanded, isSubmittingComment, actions}: Props) => {
    const {formatMessage} = useIntl();

    // Destructure actions to use stable references in dependency arrays
    const {
        setFocusedInlineCommentId,
        setPendingInlineAnchor,
        setWikiRhsActiveTab,
        openWikiRhs,
        closeRightHandSide,
        toggleRhsExpanded,
    } = actions;

    const handleBackClick = useCallback(() => {
        setFocusedInlineCommentId(null);
    }, [setFocusedInlineCommentId]);

    const handleCancelNewComment = useCallback(() => {
        setPendingInlineAnchor(null);
    }, [setPendingInlineAnchor]);

    const handleTabSwitch = useCallback((key: string) => {
        setWikiRhsActiveTab(key as 'page_comments' | 'all_threads');
    }, [setWikiRhsActiveTab]);

    const handleThreadClick = useCallback((targetPageId: string, threadId: string) => {
        if (wikiId) {
            openWikiRhs(targetPageId, wikiId, threadId);
        }
    }, [wikiId, openWikiRhs]);

    // When creating a new inline comment, show the new comment view
    // Also keep showing during submission to prevent UI flash when pendingInlineAnchor is cleared
    if ((pendingInlineAnchor || isSubmittingComment) && pageId && wikiId && !focusedInlineCommentId) {
        return (
            <div
                className='sidebar--right__content WikiRHS'
                data-testid='wiki-rhs'
            >
                <div
                    className='WikiRHS__header'
                    data-testid='wiki-rhs-header'
                >
                    <WithTooltip
                        title={
                            <FormattedMessage
                                id='wiki_rhs.cancelNewCommentTooltip'
                                defaultMessage='Cancel'
                            />
                        }
                    >
                        <button
                            className='sidebar--right__back btn btn-icon btn-sm'
                            onClick={handleCancelNewComment}
                            aria-label={formatMessage({id: 'wiki_rhs.cancel.icon', defaultMessage: 'Cancel Icon'})}
                            data-testid='wiki-rhs-back-button'
                        >
                            <i className='icon icon-arrow-back-ios'/>
                        </button>
                    </WithTooltip>
                    <h2 data-testid='wiki-rhs-header-title'>
                        <FormattedMessage
                            id='wiki.comments.new_comment_header'
                            defaultMessage='New Comment'
                        />
                    </h2>
                    <div
                        className='WikiRHS__header-actions'
                        data-testid='wiki-rhs-header-actions'
                    >
                        <button
                            type='button'
                            className='sidebar--right__expand btn btn-icon btn-sm'
                            aria-label={isExpanded ? formatMessage({id: 'wiki_rhs.collapse_sidebar', defaultMessage: 'Collapse Sidebar'}) : formatMessage({id: 'wiki_rhs.expand_sidebar', defaultMessage: 'Expand Sidebar'})}
                            onClick={toggleRhsExpanded}
                            data-testid='wiki-rhs-expand-button'
                        >
                            <i
                                className='icon icon-arrow-expand'
                                aria-hidden='true'
                            />
                            <i
                                className='icon icon-arrow-collapse'
                                aria-hidden='true'
                            />
                        </button>
                        <button
                            className='WikiRHS__close-btn'
                            aria-label={formatMessage({id: 'wiki_rhs.close', defaultMessage: 'Close'})}
                            onClick={closeRightHandSide}
                            data-testid='wiki-rhs-close-button'
                        >
                            <i className='icon-close'/>
                        </button>
                    </div>
                </div>
                {pendingInlineAnchor ? (
                    <WikiNewCommentView
                        pageId={pageId}
                        anchor={pendingInlineAnchor}
                    />
                ) : (
                    <div className='WikiRHS__loading'>
                        <FormattedMessage
                            id='wiki_rhs.submitting_comment'
                            defaultMessage='Submitting comment...'
                        />
                    </div>
                )}
            </div>
        );
    }

    // When focused on an inline comment, show single thread view (no tabs)
    if (focusedInlineCommentId) {
        const backToCommentsTooltip = (
            <FormattedMessage
                id='wiki_rhs.backToCommentsTooltip'
                defaultMessage='Back to comments'
            />
        );

        return (
            <div
                className='sidebar--right__content WikiRHS'
                data-testid='wiki-rhs'
            >
                <div
                    className='WikiRHS__header'
                    data-testid='wiki-rhs-header'
                >
                    <WithTooltip title={backToCommentsTooltip}>
                        <button
                            className='sidebar--right__back btn btn-icon btn-sm'
                            onClick={handleBackClick}
                            aria-label={formatMessage({id: 'wiki_rhs.back.icon', defaultMessage: 'Back Icon'})}
                            data-testid='wiki-rhs-back-button'
                        >
                            <i className='icon icon-arrow-back-ios'/>
                        </button>
                    </WithTooltip>
                    <h2 data-testid='wiki-rhs-header-title'>
                        <FormattedMessage
                            id='wiki.comments.thread_header'
                            defaultMessage='Thread'
                        />
                    </h2>
                    <div
                        className='WikiRHS__header-actions'
                        data-testid='wiki-rhs-header-actions'
                    >
                        <button
                            type='button'
                            className='sidebar--right__expand btn btn-icon btn-sm'
                            aria-label={isExpanded ? formatMessage({id: 'wiki_rhs.collapse_sidebar', defaultMessage: 'Collapse Sidebar'}) : formatMessage({id: 'wiki_rhs.expand_sidebar', defaultMessage: 'Expand Sidebar'})}
                            onClick={toggleRhsExpanded}
                            data-testid='wiki-rhs-expand-button'
                        >
                            <i
                                className='icon icon-arrow-expand'
                                aria-hidden='true'
                            />
                            <i
                                className='icon icon-arrow-collapse'
                                aria-hidden='true'
                            />
                        </button>
                        <button
                            className='WikiRHS__close-btn'
                            aria-label={formatMessage({id: 'wiki_rhs.close', defaultMessage: 'Close'})}
                            onClick={closeRightHandSide}
                            data-testid='wiki-rhs-close-button'
                        >
                            <i className='icon-close'/>
                        </button>
                    </div>
                </div>
                <div
                    className='WikiRHS__thread-content'
                    data-testid='wiki-rhs-thread-content'
                >
                    {pageId && channelLoaded && (
                        <WikiThreadViewer
                            key={`${pageId}-${focusedInlineCommentId || 'list'}`}
                            rootPostId={pageId}
                            useRelativeTimestamp={true}
                            isThreadView={true}
                            hideRootPost={true}
                        />
                    )}
                </div>
            </div>
        );
    }

    // Default view: Show tabs for page comments and all threads
    return (
        <div
            className='sidebar--right__content WikiRHS'
            data-testid='wiki-rhs'
        >
            <div
                className='WikiRHS__header'
                data-testid='wiki-rhs-header'
            >
                <h2 data-testid='wiki-rhs-header-title'>
                    <FormattedMessage
                        id='wiki.comments.header'
                        defaultMessage='Comments'
                    />
                </h2>
                {activeTab === 'page_comments' && pageTitle && (
                    <span
                        className='WikiRHS__page-title'
                        data-testid='wiki-rhs-page-title'
                    >
                        {pageTitle}
                    </span>
                )}
                <div
                    className='WikiRHS__header-actions'
                    data-testid='wiki-rhs-header-actions'
                >
                    <button
                        type='button'
                        className='sidebar--right__expand btn btn-icon btn-sm'
                        aria-label={isExpanded ? formatMessage({id: 'wiki_rhs.collapse_sidebar', defaultMessage: 'Collapse Sidebar'}) : formatMessage({id: 'wiki_rhs.expand_sidebar', defaultMessage: 'Expand Sidebar'})}
                        onClick={toggleRhsExpanded}
                        data-testid='wiki-rhs-expand-button'
                    >
                        <i
                            className='icon icon-arrow-expand'
                            aria-hidden='true'
                        />
                        <i
                            className='icon icon-arrow-collapse'
                            aria-hidden='true'
                        />
                    </button>
                    <button
                        className='WikiRHS__close-btn'
                        aria-label={formatMessage({id: 'wiki_rhs.close', defaultMessage: 'Close'})}
                        onClick={closeRightHandSide}
                        data-testid='wiki-rhs-close-button'
                    >
                        <i className='icon-close'/>
                    </button>
                </div>
            </div>

            <Tabs
                id='wiki_rhs_tabs'
                activeKey={activeTab}

                // @ts-expect-error The types that we have for React Bootstrap are for a newer version than we use
                onSelect={handleTabSwitch}
                className='WikiRHS__tabs'
            >
                <Tab
                    eventKey='page_comments'
                    title={formatMessage({id: 'wiki_rhs.tab.page_comments', defaultMessage: 'Page Comments'})}
                    tabClassName='WikiRHS__tab'
                >
                    <div
                        className='WikiRHS__comments-content'
                        data-testid='wiki-rhs-comments-content'
                    >
                        {pageId && channelLoaded && (
                            <WikiThreadViewer
                                key={pageId}
                                rootPostId={pageId}
                                useRelativeTimestamp={true}
                                isThreadView={false}
                                hideRootPost={true}
                            />
                        )}
                        {pageId && !channelLoaded && (
                            <div
                                className='WikiRHS__empty-state'
                                data-testid='wiki-rhs-loading'
                            >
                                <p>
                                    <FormattedMessage
                                        id='wiki_rhs.loading'
                                        defaultMessage='Loading...'
                                    />
                                </p>
                            </div>
                        )}
                        {!pageId && (
                            <div
                                className='WikiRHS__empty-state'
                                data-testid='wiki-rhs-empty-state'
                            >
                                <p>
                                    <FormattedMessage
                                        id='wiki.comments.save_to_enable'
                                        defaultMessage='Save page to enable comments'
                                    />
                                </p>
                            </div>
                        )}
                    </div>
                </Tab>
                <Tab
                    eventKey='all_threads'
                    title={formatMessage({id: 'wiki_rhs.tab.all_threads', defaultMessage: 'All Threads'})}
                    tabClassName='WikiRHS__tab'
                >
                    <div
                        className='WikiRHS__all-threads-content'
                        data-testid='wiki-rhs-all-threads-content'
                    >
                        {wikiId ? (
                            <AllWikiThreads
                                wikiId={wikiId}
                                onThreadClick={handleThreadClick}
                            />
                        ) : (
                            <div className='WikiRHS__empty-state'>
                                <p>
                                    <FormattedMessage
                                        id='wiki.comments.no_wiki'
                                        defaultMessage='No wiki selected'
                                    />
                                </p>
                            </div>
                        )}
                    </div>
                </Tab>
            </Tabs>
        </div>
    );
};

export default WikiRHS;
