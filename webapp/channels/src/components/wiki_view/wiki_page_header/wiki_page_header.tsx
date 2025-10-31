// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import PageBreadcrumb from '../page_breadcrumb';

type Props = {
    wikiId: string;
    pageId: string;
    channelId: string;
    isDraft: boolean;
    parentPageId?: string;
    draftTitle?: string;
    onEdit: () => void;
    onPublish: () => void;
    onToggleComments: () => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
};

const WikiPageHeader = ({
    wikiId,
    pageId,
    channelId,
    isDraft,
    parentPageId,
    draftTitle,
    onEdit,
    onPublish,
    onToggleComments,
    isFullscreen,
    onToggleFullscreen,
}: Props) => {
    return (
        <div
            className='PagePane__header'
            data-testid='wiki-page-header'
        >
            <div
                className='PagePane__header-inner'
                data-testid='wiki-page-header-inner'
            >
                <PageBreadcrumb
                    wikiId={wikiId}
                    pageId={pageId}
                    channelId={channelId}
                    isDraft={isDraft}
                    parentPageId={parentPageId}
                    draftTitle={draftTitle}
                    className='PagePane__breadcrumb'
                />
                <div
                    className='PagePane__controls'
                    data-testid='wiki-page-controls'
                >
                    <button
                        className='PagePane__icon-button'
                        aria-label='Toggle comments'
                        title='Toggle comments'
                        onClick={onToggleComments}
                        data-testid='wiki-page-toggle-comments'
                    >
                        <i className='icon-message-text-outline'/>
                    </button>
                    {onToggleFullscreen && (
                        <button
                            className='PagePane__icon-button'
                            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                            onClick={onToggleFullscreen}
                            data-testid='wiki-page-fullscreen-button'
                        >
                            <i className={isFullscreen ? 'icon-arrow-collapse' : 'icon-arrow-expand'}/>
                        </button>
                    )}
                    {isDraft ? (
                        <button
                            className='btn btn-primary'
                            aria-label='Publish'
                            title='Publish'
                            onClick={onPublish}
                            data-testid='wiki-page-publish-button'
                        >
                            <i className='icon-check'/>
                            {'Publish'}
                        </button>
                    ) : (
                        <button
                            className='btn btn-primary'
                            aria-label='Edit'
                            title='Edit'
                            onClick={onEdit}
                            data-testid='wiki-page-edit-button'
                        >
                            <i className='icon-pencil-outline'/>
                            {'Edit'}
                        </button>
                    )}
                    <button
                        className='PagePane__icon-button'
                        aria-label='More actions'
                        title='More actions'
                        data-testid='wiki-page-more-actions'
                    >
                        <i className='icon-dots-vertical'/>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WikiPageHeader;
