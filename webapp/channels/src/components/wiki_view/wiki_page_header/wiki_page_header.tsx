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
                    className='PagePane__icon-button btn btn-icon btn-sm'
                    aria-label='Toggle comments'
                    title='Toggle comments'
                    onClick={onToggleComments}
                >
                    <i className='icon icon-message-text-outline'/>
                </button>
                {isDraft ? (
                    <button
                        className='btn btn-primary btn-sm'
                        aria-label='Publish'
                        title='Publish'
                        onClick={onPublish}
                    >
                        <i className='icon icon-check'/>
                        {'Publish'}
                    </button>
                ) : (
                    <button
                        className='btn btn-tertiary btn-sm'
                        aria-label='Edit'
                        title='Edit'
                        onClick={onEdit}
                    >
                        <i className='icon icon-pencil-outline'/>
                        {'Edit'}
                    </button>
                )}
                <button
                    className='PagePane__icon-button btn btn-icon btn-sm'
                    aria-label='More actions'
                    title='More actions'
                >
                    <i className='icon icon-dots-vertical'/>
                </button>
            </div>
        </div>
    );
};

export default WikiPageHeader;
