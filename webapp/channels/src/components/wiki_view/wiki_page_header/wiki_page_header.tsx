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
    onToggleRhs: () => void;
    onOpenComments: () => void;
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
    onToggleRhs,
    onOpenComments,
}: Props) => {
    return (
        <div className='PagePane__header'>
            <PageBreadcrumb
                wikiId={wikiId}
                pageId={pageId}
                channelId={channelId}
                isDraft={isDraft}
                parentPageId={parentPageId}
                draftTitle={draftTitle}
                className='PagePane__breadcrumb'
            />
            <div className='PagePane__controls'>
                <button
                    className='PagePane__icon-button'
                    aria-label='Comments'
                    title='Comments'
                    onClick={onOpenComments}
                >
                    <i className='icon-message-text-outline'/>
                    <span className='badge'>{'8'}</span>
                </button>
                <button
                    className='PagePane__icon-button'
                    aria-label='Watchers'
                    title='Watchers'
                >
                    <i className='icon-account-multiple-outline'/>
                    <span className='avatar-group'>
                        <span className='avatar-count'>{'+2'}</span>
                    </span>
                </button>
                {isDraft ? (
                    <button
                        className='btn btn-primary'
                        aria-label='Publish'
                        title='Publish'
                        onClick={onPublish}
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
                    >
                        <i className='icon-pencil-outline'/>
                        {'Edit'}
                    </button>
                )}
                <button
                    className='PagePane__icon-button'
                    aria-label='More actions'
                    title='More actions'
                >
                    <i className='icon-dots-vertical'/>
                </button>
                <button
                    className='PagePane__icon-button'
                    onClick={onToggleRhs}
                    aria-label='Toggle sidebar'
                    title='Toggle sidebar'
                >
                    <i className='icon-dock-right'/>
                </button>
            </div>
        </div>
    );
};

export default WikiPageHeader;
