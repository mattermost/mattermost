// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {fetchPage} from 'actions/pages';
import {getPage, getPageStatus, getPageStatusField} from 'selectors/pages';

import ActiveEditorsIndicator from 'components/active_editors_indicator/active_editors_indicator';
import {useUser} from 'components/common/hooks/useUser';
import LoadingScreen from 'components/loading_screen';
import ProfilePicture from 'components/profile_picture';
import UserProfile from 'components/user_profile';

import {getPageTitle} from 'utils/page_utils';
import * as Utils from 'utils/utils';

import type {GlobalState} from 'types/store';

import {usePageInlineComments} from '../hooks/usePageInlineComments';
import TipTapEditor from '../wiki_page_editor/tiptap_editor';

import './page_viewer.scss';

type Props = {
    pageId: string;
    wikiId: string | null;
};

const PageViewer = ({pageId, wikiId}: Props) => {
    const dispatch = useDispatch();
    const page = useSelector((state: GlobalState) => getPage(state, pageId));
    const pageStatus = useSelector((state: GlobalState) => getPageStatus(state, pageId));
    const pageStatusField = useSelector(getPageStatusField);
    const statusColor = React.useMemo(
        () => pageStatusField?.attrs?.options?.find((opt) => opt.name === pageStatus)?.color || '',
        [pageStatusField, pageStatus],
    );
    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);

    const author = useUser(page?.user_id || '');

    // Use shared inline comments hook
    const {
        inlineComments,
        handleCommentClick,
        handleCreateInlineComment,
        deletedAnchorIds,
        clearDeletedAnchorIds,
    } = usePageInlineComments(pageId, wikiId || undefined);

    // Only fetch when the page exists in state but lacks content (hierarchy stub).
    // If `page` is absent, do not fetch — that path is handled by the parent WikiView
    // bundle loader, and refetching here would race with optimistic deletes (the
    // server may still serve a cached non-deleted copy and re-add the page to state).
    const isPageContentMissing = Boolean(page) && (!page!.body || page!.body.trim() === '');

    useEffect(() => {
        if (pageId && wikiId && isPageContentMissing) {
            dispatch(fetchPage(pageId, wikiId));
        }
    }, [pageId, wikiId, isPageContentMissing, dispatch]);

    // Parse page content to JSON object for TipTap (not a string)
    // Include pageId in dependencies to force re-parse when navigating to different pages
    const pageContentJson = React.useMemo(() => {
        if (!page) {
            return {type: 'doc', content: []};
        }
        const body = page.body || '';
        if (!body || body.trim() === '') {
            return {type: 'doc', content: []};
        }
        try {
            return JSON.parse(body);
        } catch {
            return {
                type: 'doc',
                content: [{type: 'paragraph', content: [{type: 'text', text: body}]}],
            };
        }
    }, [pageId, page?.body]);

    const handleContentChange = useCallback(() => {}, []);

    if (!page) {
        return <LoadingScreen/>;
    }

    const pageTitle = getPageTitle(page, 'Untitled Page');

    return (
        <div
            className='PageViewer'
            data-testid='page-viewer'
        >
            <div
                className='PageViewer__header'
                data-testid='page-viewer-header'
            >
                <h1
                    className='PageViewer__title'
                    data-testid='page-viewer-title'
                >
                    {pageTitle}
                </h1>
                {wikiId && (
                    <ActiveEditorsIndicator
                        wikiId={wikiId}
                        pageId={pageId}
                    />
                )}
                <div
                    className='PageViewer__meta'
                    data-testid='page-viewer-meta'
                >
                    {author && (
                        <div
                            className='PageViewer__author'
                            data-testid='page-viewer-author'
                        >
                            <ProfilePicture
                                src={Utils.imageURLForUser(page.user_id, author.last_picture_update)}
                                userId={page.user_id}
                                username={author.username}
                                size='xs'
                            />
                            <span className='PageViewer__authorText'>
                                <FormattedMessage
                                    id='page_viewer.by_author'
                                    defaultMessage='By {author}'
                                    values={{
                                        author: (
                                            <UserProfile
                                                userId={page.user_id}
                                            />
                                        ),
                                    }}
                                />
                            </span>
                        </div>
                    )}
                    <span
                        className='PageViewer__status'
                        data-testid='page-viewer-status'
                    >
                        <span
                            className='PageViewer__status-indicator'
                            data-color={statusColor}
                            aria-hidden='true'
                        />
                        {pageStatus || (
                            <FormattedMessage
                                id='page_viewer.status.none'
                                defaultMessage='No status'
                            />
                        )}
                    </span>
                </div>
            </div>
            <div
                className='PageViewer__content'
                data-testid='page-viewer-content'
            >
                <TipTapEditor
                    key={pageId}
                    content={pageContentJson}
                    contentKey={page.body ?? ''}
                    onContentChange={handleContentChange}
                    editable={false}
                    currentUserId={currentUserId}
                    channelId=''
                    teamId={currentTeamId}
                    pageId={pageId}
                    wikiId={wikiId || undefined}
                    inlineComments={inlineComments}
                    onCommentClick={handleCommentClick}
                    onCreateInlineComment={handleCreateInlineComment}
                    deletedAnchorIds={deletedAnchorIds}
                    onDeletedAnchorIdsProcessed={clearDeletedAnchorIds}
                />
            </div>
        </div>
    );
};

// Removed React.memo because it was preventing re-renders when page content changes in Redux
// PageViewer uses useSelector to get the page, so props don't change, but Redux state does
export default PageViewer;
