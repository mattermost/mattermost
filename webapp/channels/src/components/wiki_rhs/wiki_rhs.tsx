// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import WikiThreadViewer from './wiki_thread_viewer_container';

import './wiki_rhs.scss';

type Props = {
    pageId: string | null;
    wikiId: string | null;
    pageTitle: string;
    channelLoaded: boolean;
    actions: {
        publishPage: (wikiId: string, pageId: string) => Promise<any>;
        closeRightHandSide: () => void;
    };
};

const WikiRHS = ({pageId, pageTitle, channelLoaded, actions}: Props) => {
    return (
        <div className='sidebar--right__content WikiRHS'>
            <div className='WikiRHS__header'>
                <h2>{'Thread'}</h2>
                <span className='WikiRHS__page-title'>{pageTitle}</span>
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
                        onClick={actions.closeRightHandSide}
                    >
                        <i className='icon-close'/>
                    </button>
                </div>
            </div>

            <div className='WikiRHS__comments-content'>
                {pageId && channelLoaded && (
                    <WikiThreadViewer
                        rootPostId={pageId}
                        useRelativeTimestamp={true}
                        isThreadView={false}
                        hideRootPost={true}
                    />
                )}
                {pageId && !channelLoaded && (
                    <div className='WikiRHS__empty-state'>
                        <p>{'Loading...'}</p>
                    </div>
                )}
                {!pageId && (
                    <div className='WikiRHS__empty-state'>
                        <p>{'Save page to enable comments'}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WikiRHS;
