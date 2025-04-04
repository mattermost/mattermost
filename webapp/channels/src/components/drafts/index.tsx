// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect, useMemo} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {isScheduledPostsEnabled} from 'mattermost-redux/selectors/entities/scheduled_posts';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import {makeGetDrafts} from 'selectors/drafts';

import DraftList from 'components/drafts/draft_list';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import DraftsAndSchedulePostsPageHeader from './drafts_and_schedule_posts_page_header';
import DraftsAndSchedulePostsTabs from './drafts_and_schedule_posts_tabs';

import './drafts_and_schedule_posts.scss';

function Drafts() {
    const dispatch = useDispatch();

    const scheduledPostsEnabled = useSelector(isScheduledPostsEnabled);

    // We would need to get drafts here early since its needed by the draft list component
    const getDrafts = useMemo(() => makeGetDrafts(), []);
    const drafts = useSelector(getDrafts);

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
                <DraftsAndSchedulePostsTabs drafts={drafts}/>
            </DraftsAndSchedulePostsPageHeader>
        );
    }

    return (
        <DraftsAndSchedulePostsPageHeader>
            <DraftList drafts={drafts}/>
        </DraftsAndSchedulePostsPageHeader>
    );
}

export default memo(Drafts);
