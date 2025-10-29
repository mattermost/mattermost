// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect, useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {loadPage} from 'actions/pages';
import {getPage} from 'selectors/pages';

import {useUser} from 'components/common/hooks/useUser';
import LoadingScreen from 'components/loading_screen';

import type {GlobalState} from 'types/store';

import {usePageInlineComments} from '../hooks/usePageInlineComments';
import InlineCommentModal from '../inline_comment_modal';
import TipTapEditor from '../wiki_page_editor/tiptap_editor';

import './page_viewer.scss';

type Props = {
    pageId: string;
    wikiId: string | null;
};

const PageViewer = ({pageId, wikiId}: Props) => {
    const renderStartTime = React.useRef(performance.now());
    const renderCount = React.useRef(0);
    const contentRef = React.useRef<HTMLDivElement>(null);
    renderCount.current += 1;

    // Track when content is actually painted to DOM
    React.useLayoutEffect(() => {
        const paintTime = performance.now() - renderStartTime.current;

        if (contentRef.current) {
        }
    });

    React.useEffect(() => {
        const commitTime = performance.now() - renderStartTime.current;
    });

    const dispatch = useDispatch();
    const page = useSelector((state: GlobalState) => getPage(state, pageId));
    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);

    const author = useUser(page?.user_id || '');

    // Track what's causing re-renders
    const prevPropsRef = React.useRef({pageId, wikiId});
    React.useEffect(() => {
        const prev = prevPropsRef.current;
        if (prev.pageId !== pageId || prev.wikiId !== wikiId) {
            prevPropsRef.current = {pageId, wikiId};
        }
    });

    // Use shared inline comments hook
    const {
        inlineComments,
        handleCommentClick,
        handleCreateInlineComment,
        showCommentModal,
        commentAnchor,
        handleSubmitComment,
        handleCloseModal,
    } = usePageInlineComments(pageId, wikiId || undefined);

    // Derive a stable boolean from page object to avoid unnecessary effect re-runs
    // when page object reference changes but content state is the same
    const isPageContentMissing = !page || !page.message || page.message.trim() === '';

    useEffect(() => {
        // Load page if it doesn't exist OR if it exists but has no content
        // (Pages from hierarchy don't have content loaded for performance)
        if (pageId && wikiId && isPageContentMissing) {
            dispatch(loadPage(pageId, wikiId));
        }
    }, [pageId, wikiId, isPageContentMissing, dispatch]);

    if (!page) {
        return <LoadingScreen/>;
    }

    const pageTitle = (page.props?.title as string | undefined) || 'Untitled Page';
    const pageStatus = (page.props?.status as string | undefined) || 'in_progress';
    const authorName = author ? displayUsername(author, teammateNameDisplay) : 'Unknown';

    // Parse page content to JSON object for TipTap (not a string)
    // Include pageId in dependencies to force re-parse when navigating to different pages
    const pageContentJson = React.useMemo(() => {
        const message = page.message || '';
        if (!message || message.trim() === '') {
            return {type: 'doc', content: []};
        }
        try {
            return JSON.parse(message);
        } catch (e) {
            return {
                type: 'doc',
                content: [{type: 'paragraph', content: [{type: 'text', text: message}]}],
            };
        }
    }, [pageId, page.message]);

    const statusLabels: Record<string, string> = {
        in_progress: 'In progress',
        draft: 'Draft',
        published: 'Published',
        archived: 'Archived',
    };

    const handleContentChange = useCallback(() => {}, []);

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
                <div
                    className='PageViewer__meta'
                    data-testid='page-viewer-meta'
                >
                    <span
                        className='PageViewer__author'
                        data-testid='page-viewer-author'
                    >
                        {`By ${authorName}`}
                    </span>
                    <span
                        className='PageViewer__status'
                        data-testid='page-viewer-status'
                    >
                        <span className='PageViewer__status-indicator'/>
                        {statusLabels[pageStatus] || 'In progress'}
                    </span>
                </div>
            </div>
            <div
                ref={contentRef}
                className='PageViewer__content'
                data-testid='page-viewer-content'
            >
                <TipTapEditor
                    key={pageId}
                    content={pageContentJson}
                    contentKey={page.message ?? ''}
                    onContentChange={handleContentChange}
                    editable={false}
                    currentUserId={currentUserId}
                    channelId={page.channel_id}
                    teamId={currentTeamId}
                    pageId={pageId}
                    wikiId={wikiId || undefined}
                    inlineComments={inlineComments}
                    onCommentClick={handleCommentClick}
                    onCreateInlineComment={handleCreateInlineComment}
                />
            </div>
            {showCommentModal && commentAnchor && (
                <InlineCommentModal
                    selectedText={commentAnchor.text}
                    onSubmit={handleSubmitComment}
                    onExited={handleCloseModal}
                />
            )}
        </div>
    );
};

// Removed React.memo because it was preventing re-renders when page content changes in Redux
// PageViewer uses useSelector to get the page, so props don't change, but Redux state does
export default PageViewer;
