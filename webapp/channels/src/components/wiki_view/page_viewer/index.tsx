// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {loadPage} from 'actions/pages';
import {getFullPage} from 'selectors/pages';

import {useUser} from 'components/common/hooks/useUser';
import LoadingScreen from 'components/loading_screen';

import type {GlobalState} from 'types/store';

import TipTapEditor from '../wiki_page_editor/tiptap_editor';

import './page_viewer.scss';

type Props = {
    pageId: string;
    wikiId: string | null;
};

const PageViewer = ({pageId, wikiId}: Props) => {
    const dispatch = useDispatch();
    const page = useSelector((state: GlobalState) => getFullPage(state, pageId));
    const currentUserId = useSelector(getCurrentUserId);
    const currentTeamId = useSelector(getCurrentTeamId);
    const teammateNameDisplay = useSelector(getTeammateNameDisplaySetting);

    const author = useUser(page?.user_id || '');

    useEffect(() => {
        if (pageId && wikiId) {
            dispatch(loadPage(pageId, wikiId));
        }
    }, [pageId, wikiId, dispatch]);

    if (!page) {
        return <LoadingScreen/>;
    }

    const pageTitle = (page.props?.title as string | undefined) || 'Untitled Page';
    const pageContent = page.message || '';
    const pageStatus = (page.props?.status as string | undefined) || 'in_progress';
    const authorName = author ? displayUsername(author, teammateNameDisplay) : 'Unknown';

    const statusLabels: Record<string, string> = {
        in_progress: 'In progress',
        draft: 'Draft',
        published: 'Published',
        archived: 'Archived',
    };

    return (
        <div className='PageViewer'>
            <div className='PageViewer__header'>
                <h1 className='PageViewer__title'>{pageTitle}</h1>
                <div className='PageViewer__meta'>
                    <span className='PageViewer__author'>
                        {`By ${authorName}`}
                    </span>
                    <span className='PageViewer__status'>
                        <span className='PageViewer__status-indicator'/>
                        {statusLabels[pageStatus] || 'In progress'}
                    </span>
                </div>
            </div>
            <div className='PageViewer__content'>
                <TipTapEditor
                    content={pageContent}
                    onContentChange={() => {}}
                    editable={false}
                    currentUserId={currentUserId}
                    channelId={page.channel_id}
                    teamId={currentTeamId}
                />
            </div>
        </div>
    );
};

export default PageViewer;
