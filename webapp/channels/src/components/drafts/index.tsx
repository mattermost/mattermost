// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getTeammateNameDisplaySetting} from 'mattermost-redux/selectors/entities/preferences';
import {isScheduledPostsEnabled} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getStatusForUserId} from 'mattermost-redux/selectors/entities/users';
import {displayUsername} from 'mattermost-redux/utils/user_utils';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import type {Draft} from 'selectors/drafts';
import {makeGetDrafts} from 'selectors/drafts';

import DraftList from 'components/drafts/draft_list';

import type {GlobalState} from 'types/store';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import DraftsAndSchedulePostsPageHeader from './drafts_and_schedule_posts_page_header';
import DraftsAndSchedulePostsTabs from './drafts_and_schedule_posts_tabs';

import './drafts_and_schedule_posts.scss';

const EMPTY_DRAFTS: Draft[] = [];

function Drafts() {
    const dispatch = useDispatch();

    const scheduledPostsEnabled = useSelector(isScheduledPostsEnabled);

    // We would need to get drafts here early since its needed by the draft list component
    const getDrafts = useMemo(() => makeGetDrafts(), []);
    const drafts = useSelector(getDrafts);

    const currentUser = useSelector(getCurrentUser);
    const userStatus = useSelector((state: GlobalState) => getStatusForUserId(state, currentUser.id));

    const teammateNameDisplaySetting = useSelector(getTeammateNameDisplaySetting);
    const userDisplayName = useMemo(() => displayUsername(currentUser, teammateNameDisplaySetting), [currentUser, teammateNameDisplaySetting]);

    // When Drafts component mounts, select Drafts in the LHS
    // and suppress the RHS and restore RHS when component unmounts
    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    if (scheduledPostsEnabled) {
        return (
            <DraftsAndSchedulePostsPageHeader>
                <DraftsAndSchedulePostsTabs
                    drafts={drafts || EMPTY_DRAFTS}
                    currentUser={currentUser}
                    userDisplayName={userDisplayName}
                    userStatus={userStatus}
                />
            </DraftsAndSchedulePostsPageHeader>
        );
    }

    return (
        <DraftsAndSchedulePostsPageHeader>
            <DraftList
                drafts={drafts || EMPTY_DRAFTS}
                currentUser={currentUser}
                userDisplayName={userDisplayName}
                userStatus={userStatus}
            />
        </DraftsAndSchedulePostsPageHeader>
    );
}

export default memo(Drafts);
