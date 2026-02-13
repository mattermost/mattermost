// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState, useCallback} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getPost} from 'mattermost-redux/selectors/entities/posts';

import {createBookmarkFromPage} from 'actions/channel_bookmarks';
import {hasUnpublishedChanges} from 'selectors/page_drafts';

import BookmarkChannelSelect from 'components/bookmark_channel_select';

import type {GlobalState} from 'types/store';

import TranslationIndicator from './translation_indicator';

import PageActionsMenu from '../../pages_hierarchy_panel/page_actions_menu';
import PageBreadcrumb from '../page_breadcrumb';

type Props = {
    wikiId: string;
    pageId: string;
    channelId: string;
    isDraft: boolean;
    isExistingPage?: boolean;
    parentPageId?: string;
    draftTitle?: string;
    onEdit: () => void;
    onPublish: () => void;
    onToggleComments: () => void;
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
    onCreateChild?: () => void;
    onRename?: () => void;
    onDuplicate?: () => void;
    onMove?: () => void;
    onDelete?: () => void;
    onVersionHistory?: () => void;
    onNavigateToPage?: (pageId: string) => void;
    pageLink?: string;
    canEdit?: boolean;
    onProofread?: () => void;
    onTranslatePage?: () => void;
    isAIProcessing?: boolean;
    onCopyMarkdown?: () => void;
};

const WikiPageHeader = ({
    wikiId,
    pageId,
    channelId,
    isDraft,
    isExistingPage,
    parentPageId,
    draftTitle,
    onEdit,
    onPublish,
    onToggleComments,
    isFullscreen,
    onToggleFullscreen,
    onCreateChild,
    onRename,
    onDuplicate,
    onMove,
    onDelete,
    onVersionHistory,
    onNavigateToPage,
    pageLink,
    canEdit = true,
    onProofread,
    onTranslatePage,
    isAIProcessing,
    onCopyMarkdown,
}: Props) => {
    const {formatMessage} = useIntl();
    const dispatch = useDispatch();
    const [showBookmarkModal, setShowBookmarkModal] = useState(false);

    const page = useSelector((state: GlobalState) => getPost(state, pageId));
    const showUnpublishedIndicator = useSelector((state: GlobalState) => {
        if (isDraft || !pageId || !wikiId) {
            return false;
        }
        const pageContent = getPost(state, pageId)?.message || '';
        return hasUnpublishedChanges(state, wikiId, pageId, pageContent);
    });

    const handleBookmarkInChannel = useCallback(() => {
        setShowBookmarkModal(true);
    }, []);

    const handleChannelSelected = useCallback(async (selectedChannelId: string) => {
        if (page && page.props?.title) {
            const title = typeof page.props.title === 'string' ? page.props.title : String(page.props.title);
            await dispatch(createBookmarkFromPage(selectedChannelId, pageId, title));
        }
    }, [dispatch, pageId, page]);

    const handleCloseBookmarkModal = useCallback(() => {
        setShowBookmarkModal(false);
    }, []);

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
                    {!isDraft && pageId && (
                        <TranslationIndicator
                            pageId={pageId}
                            onNavigateToPage={onNavigateToPage}
                        />
                    )}
                    {showUnpublishedIndicator && (
                        <span
                            className='PagePane__unpublished-indicator'
                            data-testid='wiki-page-unpublished-indicator'
                        >
                            {formatMessage({id: 'wiki_page_header.unpublished_changes', defaultMessage: 'Unpublished changes'})}
                        </span>
                    )}
                    {(!isDraft || isExistingPage) && (
                        <button
                            className='PagePane__icon-button btn btn-icon btn-sm'
                            aria-label={formatMessage({id: 'wiki_page_header.toggle_comments', defaultMessage: 'Toggle comments'})}
                            title={formatMessage({id: 'wiki_page_header.toggle_comments', defaultMessage: 'Toggle comments'})}
                            onClick={onToggleComments}
                            data-testid='wiki-page-toggle-comments'
                        >
                            <i className='icon icon-message-text-outline'/>
                        </button>
                    )}
                    {isDraft ? (
                        <button
                            className='PagePane__publish-button btn btn-primary'
                            aria-label={isExistingPage ?
                                formatMessage({id: 'wiki_page_header.update', defaultMessage: 'Update'}) :
                                formatMessage({id: 'wiki_page_header.publish', defaultMessage: 'Publish'})}
                            title={isExistingPage ?
                                formatMessage({id: 'wiki_page_header.update', defaultMessage: 'Update'}) :
                                formatMessage({id: 'wiki_page_header.publish', defaultMessage: 'Publish'})}
                            onClick={onPublish}
                            data-testid='wiki-page-publish-button'
                        >
                            <i className='icon-check'/>
                            {isExistingPage ?
                                formatMessage({id: 'wiki_page_header.update', defaultMessage: 'Update'}) :
                                formatMessage({id: 'wiki_page_header.publish', defaultMessage: 'Publish'})}
                        </button>
                    ) : (
                        <button
                            className='PagePane__edit-button btn btn-tertiary'
                            aria-label={formatMessage({id: 'wiki_page_header.edit', defaultMessage: 'Edit'})}
                            title={formatMessage({id: 'wiki_page_header.edit', defaultMessage: 'Edit'})}
                            onClick={onEdit}
                            disabled={!canEdit}
                            data-testid='wiki-page-edit-button'
                        >
                            <i className='icon icon-pencil-outline'/>
                            {formatMessage({id: 'wiki_page_header.edit', defaultMessage: 'Edit'})}
                        </button>
                    )}
                    {pageId && (
                        <PageActionsMenu
                            pageId={pageId}
                            wikiId={wikiId}
                            onCreateChild={onCreateChild}
                            onRename={onRename}
                            onDuplicate={onDuplicate}
                            onMove={onMove}
                            onBookmarkInChannel={handleBookmarkInChannel}
                            onDelete={onDelete}
                            onVersionHistory={onVersionHistory}
                            isDraft={isDraft}
                            canDuplicate={!isDraft || isExistingPage}
                            pageLink={pageLink}
                            buttonTestId='wiki-page-more-actions'
                            onProofread={onProofread}
                            onTranslatePage={onTranslatePage}
                            isAIProcessing={isAIProcessing}
                            onCopyMarkdown={onCopyMarkdown}
                        />
                    )}
                    {onToggleFullscreen && (
                        <button
                            className='PagePane__icon-button btn btn-icon btn-sm'
                            aria-label={isFullscreen ?
                                formatMessage({id: 'wiki_page_header.exit_fullscreen', defaultMessage: 'Exit fullscreen'}) :
                                formatMessage({id: 'wiki_page_header.enter_fullscreen', defaultMessage: 'Enter fullscreen'})}
                            title={isFullscreen ?
                                formatMessage({id: 'wiki_page_header.exit_fullscreen', defaultMessage: 'Exit fullscreen'}) :
                                formatMessage({id: 'wiki_page_header.enter_fullscreen', defaultMessage: 'Enter fullscreen'})}
                            onClick={onToggleFullscreen}
                            data-testid='wiki-page-fullscreen-button'
                        >
                            {isFullscreen ? (
                                <i className='icon icon-arrow-collapse'/>
                            ) : (
                                <i className='icon icon-arrow-expand'/>
                            )}
                        </button>
                    )}
                </div>
            </div>
            {showBookmarkModal && (
                <BookmarkChannelSelect
                    onSelect={handleChannelSelected}
                    onClose={handleCloseBookmarkModal}
                    title={formatMessage({id: 'wiki_page_header.bookmark_in_channel', defaultMessage: 'Bookmark in channel'})}
                />
            )}
        </div>
    );
};

export default WikiPageHeader;
