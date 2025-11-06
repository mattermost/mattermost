// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {lazy} from 'react';

import {makeAsyncComponent} from 'components/async_load';
import deferComponentRender from 'components/deferComponentRender';
import PostView from 'components/post_view';

import type {TabType} from './channel_tabs';

import './channel_tab_panel.scss';

// Lazy load components for different tab content
const ChannelFilesContent = makeAsyncComponent('ChannelFilesContent', lazy(() => import('./channel_files_content')));
const WikiView = makeAsyncComponent('WikiView', lazy(() => import('components/wiki_view')));

interface Props {
    channelId: string;
    activeTab: TabType;
    focusedPostId?: string;
    createPost?: React.ReactNode;
}

// Create deferred post view for messages tab
const createDeferredPostView = () => {
    return deferComponentRender(
        PostView,
        <div
            id='post-list'
            className='a11y__region'
            data-a11y-sort-order='1'
            data-a11y-focus-child={true}
            data-a11y-order-reversed={true}
        />,
    );
};

function ChannelTabContent({
    channelId,
    activeTab,
    focusedPostId,
    createPost,
}: Props) {
    const renderTabContent = () => {
        if (activeTab === 'messages') {
            const DeferredPostView = createDeferredPostView();
            return (
                <div className='channel-tab-panel-content channel-tab-panel-content--messages'>
                    <DeferredPostView
                        channelId={channelId}
                        focusedPostId={focusedPostId}
                    />
                    {createPost}
                </div>
            );
        }

        if (activeTab === 'files') {
            return (
                <div className='channel-tab-panel-content channel-tab-panel-content--files'>
                    <ChannelFilesContent channelId={channelId}/>
                </div>
            );
        }

        if (activeTab.startsWith('wiki-')) {
            return (
                <div className='channel-tab-panel-content channel-tab-panel-content--wiki'>
                    <WikiView/>
                </div>
            );
        }

        // Bookmarks and other tabs handled by menu/dropdown
        return null;
    };

    return (
        <div
            role='tabpanel'
            id={`channel-tab-panel-${activeTab}`}
            aria-labelledby={`channel-tab-${activeTab}`}
            className='channel-tab-panel'
        >
            {renderTabContent()}
        </div>
    );
}

export default ChannelTabContent;
