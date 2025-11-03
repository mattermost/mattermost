// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';

import Tab from 'components/tabs/tab';
import Tabs from 'components/tabs/tabs';

import AllWikiThreads from './all_wiki_threads';
import WikiThreadViewer from './wiki_thread_viewer_container';

import './wiki_rhs.scss';

type Props = {
    pageId: string | null;
    wikiId: string | null;
    pageTitle: string;
    channelLoaded: boolean;
    activeTab: 'page_comments' | 'all_threads';
    actions: {
        publishPage: (wikiId: string, pageId: string) => Promise<any>;
        closeRightHandSide: () => void;
        setWikiRhsActiveTab: (tab: 'page_comments' | 'all_threads') => void;
        openWikiRhs: (pageId: string, wikiId: string, focusedInlineCommentId?: string) => void;
    };
};

const WikiRHS = ({pageId, wikiId, pageTitle, channelLoaded, activeTab, actions}: Props) => {
    const handleTabSwitch = useCallback((key: any) => {
        if (typeof key === 'string') {
            actions.setWikiRhsActiveTab(key as 'page_comments' | 'all_threads');
        }
    }, [actions]);

    const handleThreadClick = useCallback((targetPageId: string, threadId: string) => {
        if (wikiId) {
            actions.openWikiRhs(targetPageId, wikiId, threadId);
            actions.setWikiRhsActiveTab('page_comments');
        }
    }, [wikiId, actions]);

    return (
        <div
            className='sidebar--right__content WikiRHS'
            data-testid='wiki-rhs'
        >
            <div
                className='WikiRHS__header'
                data-testid='wiki-rhs-header'
            >
                <h2 data-testid='wiki-rhs-header-title'>{'Comments'}</h2>
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
                        className='WikiRHS__expand-btn'
                        aria-label='Expand'
                        data-testid='wiki-rhs-expand-button'
                    >
                        <i className='icon-arrow-expand'/>
                    </button>
                    <button
                        className='WikiRHS__close-btn'
                        aria-label='Close'
                        onClick={actions.closeRightHandSide}
                        data-testid='wiki-rhs-close-button'
                    >
                        <i className='icon-close'/>
                    </button>
                </div>
            </div>

            <Tabs
                id='wiki_rhs_tabs'
                activeKey={activeTab}
                onSelect={handleTabSwitch}
                className='WikiRHS__tabs'
            >
                <Tab
                    eventKey='page_comments'
                    title='Page Comments'
                    tabClassName='WikiRHS__tab'
                >
                    <div
                        className='WikiRHS__comments-content'
                        data-testid='wiki-rhs-comments-content'
                    >
                        {pageId && channelLoaded && (
                            <WikiThreadViewer
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
                                <p>{'Loading...'}</p>
                            </div>
                        )}
                        {!pageId && (
                            <div
                                className='WikiRHS__empty-state'
                                data-testid='wiki-rhs-empty-state'
                            >
                                <p>{'Save page to enable comments'}</p>
                            </div>
                        )}
                    </div>
                </Tab>
                <Tab
                    eventKey='all_threads'
                    title='All Threads'
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
                                <p>{'No wiki selected'}</p>
                            </div>
                        )}
                    </div>
                </Tab>
            </Tabs>
        </div>
    );
};

export default WikiRHS;
