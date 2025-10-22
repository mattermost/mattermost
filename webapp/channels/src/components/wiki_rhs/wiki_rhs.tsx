// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';

import ThreadViewer from 'components/threading/thread_viewer';

import PageOutline from './page_outline';

import './wiki_rhs.scss';

type WikiRHSMode = 'outline' | 'comments';

type Props = {
    pageId: string | null;
    wikiId: string | null;
    mode: WikiRHSMode;
    actions: {
        publishPage: (wikiId: string, pageId: string) => Promise<any>;
    };
};

const WikiRHS = ({pageId, mode: initialMode}: Props) => {
    const [mode, setMode] = useState<WikiRHSMode>(initialMode || 'outline');

    return (
        <div className='sidebar--right__content WikiRHS'>
            <div className='WikiRHS__header'>
                <h2>{'Threads'}</h2>
                <span className='WikiRHS__page-title'>{'Overview'}</span>
                <div className='WikiRHS__header-actions'>
                    <button
                        className='WikiRHS__expand-btn'
                        aria-label='Expand'
                    >
                        <i className='icon-arrow-expand'/>
                    </button>
                    <button
                        className='WikiRHS__close-btn'
                        aria-label='Close'
                    >
                        <i className='icon-close'/>
                    </button>
                </div>
            </div>

            <div className='WikiRHS__tabs'>
                <button
                    className={mode === 'comments' ? 'active' : ''}
                    onClick={() => setMode('comments')}
                >
                    {'This page'}
                </button>
                <button
                    className={mode === 'outline' ? 'active' : ''}
                    onClick={() => setMode('outline')}
                >
                    {'All'}
                </button>
                <button
                    className='WikiRHS__filter-btn'
                    aria-label='Filter'
                >
                    <i className='icon-filter-variant'/>
                </button>
            </div>

            {mode === 'outline' ? (
                <>
                    <div className='WikiRHS__outline-content'>
                        <div className='WikiRHS__outline-header'>
                            <h3>{'IN THIS PAGE'}</h3>
                        </div>
                        {pageId ? (
                            <PageOutline/>
                        ) : (
                            <div className='WikiRHS__empty-state'>
                                <p>{'Start typing to see page outline'}</p>
                            </div>
                        )}
                    </div>
                    <div className='WikiRHS__actions'>
                        <button
                            className='WikiRHS__view-comments-btn'
                            onClick={() => setMode('comments')}
                        >
                            <i className='icon-message-text-outline'/>
                            {'View Comments'}
                        </button>
                    </div>
                </>
            ) : (
                <>
                    <div className='WikiRHS__comments-content'>
                        {pageId ? (
                            <ThreadViewer
                                rootPostId={pageId}
                                useRelativeTimestamp={true}
                                isThreadView={false}
                            />
                        ) : (
                            <div className='WikiRHS__empty-state'>
                                <p>{'Save page to enable comments'}</p>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default WikiRHS;
