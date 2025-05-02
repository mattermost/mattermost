// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Badge} from '@mui/base';
import React, {useCallback, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory, useLocation} from 'react-router-dom';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {makeGetScheduledPostsByTeam} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {type Draft} from 'selectors/drafts';

import DraftList from 'components/drafts/draft_list';
import ScheduledPostList from 'components/drafts/scheduled_post_list';
import Tab from 'components/tabs/tab';
import Tabs from 'components/tabs/tabs';

import {DRAFT_URL_SUFFIX, SCHEDULED_POST_URL_SUFFIX} from 'utils/constants';

import type {GlobalState} from 'types/store';

const EMPTY_SCHEDULED_POSTS: ScheduledPost[] = [];

const TAB_KEYS = {
    DRAFTS: 'drafts',
    SCHEDULED_POSTS: 'scheduled_posts',
};

type Props = {
    drafts: Draft[];
    currentUser: UserProfile;
    userDisplayName: string;
    userStatus: UserStatus['status'];
}

export default function DraftsAndSchedulePostsTabs(props: Props) {
    const history = useHistory();
    const location = useLocation();
    const isDraftsTab = location.pathname.includes(DRAFT_URL_SUFFIX);
    const isScheduledPostsTab = location.pathname.includes(SCHEDULED_POST_URL_SUFFIX);

    const currentTeam = useSelector(getCurrentTeam);
    const currentTeamName = currentTeam?.name ?? '';
    const currentTeamId = currentTeam?.id ?? '';

    const getScheduledPostsByTeam = useMemo(() => makeGetScheduledPostsByTeam(), []);
    const scheduledPosts = useSelector((state: GlobalState) => getScheduledPostsByTeam(state, currentTeamId, true));

    const handleSwitchTabs = useCallback((key) => {
        if (key === TAB_KEYS.DRAFTS) {
            history.push(`/${currentTeamName}/drafts`);
        } else if (key === TAB_KEYS.SCHEDULED_POSTS) {
            history.push(`/${currentTeamName}/scheduled_posts`);
        }
    }, [history, currentTeamName]);

    const scheduledPostsTabHeading = useMemo(() => {
        return (
            <div className='drafts_tab_title'>
                <FormattedMessage
                    id='schedule_post.tab.heading'
                    defaultMessage='Scheduled'
                />
                {scheduledPosts?.length > 0 && (
                    <Badge
                        className='badge'
                        badgeContent={scheduledPosts.length}
                    />
                )}
            </div>
        );
    }, [scheduledPosts?.length]);

    const draftTabHeading = useMemo(() => {
        return (
            <div className='drafts_tab_title'>
                <FormattedMessage
                    id='drafts.heading'
                    defaultMessage='Drafts'
                />
                {props.drafts.length > 0 && (
                    <Badge
                        className='badge'
                        badgeContent={props.drafts.length}
                    />
                )}
            </div>
        );
    }, [props.drafts.length]);

    const activeTab = useMemo(() => {
        if (isDraftsTab) {
            return TAB_KEYS.DRAFTS;
        } else if (isScheduledPostsTab) {
            return TAB_KEYS.SCHEDULED_POSTS;
        }
        return '';
    }, [isDraftsTab, isScheduledPostsTab]);

    return (
        <Tabs
            id='draft_tabs'
            activeKey={activeTab}
            mountOnEnter={true}
            unmountOnExit={true}
            onSelect={handleSwitchTabs}
        >
            <Tab
                eventKey={TAB_KEYS.DRAFTS}
                title={draftTabHeading}
                unmountOnExit={true}
                tabClassName='drafts_tab'
                tabIndex={0}
            >
                <DraftList
                    drafts={props.drafts}
                    currentUser={props.currentUser}
                    userDisplayName={props.userDisplayName}
                    userStatus={props.userStatus}
                />
            </Tab>
            <Tab
                eventKey={TAB_KEYS.SCHEDULED_POSTS}
                title={scheduledPostsTabHeading}
                unmountOnExit={true}
                tabClassName='drafts_tab'
            >
                <ScheduledPostList
                    scheduledPosts={scheduledPosts || EMPTY_SCHEDULED_POSTS}
                    currentUser={props.currentUser}
                    userDisplayName={props.userDisplayName}
                    userStatus={props.userStatus}
                />
            </Tab>
        </Tabs>
    );
}

