// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {Badge} from '@mui/base';
import React, {memo, useCallback, useEffect, useMemo} from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';
import {type match, useHistory, useRouteMatch} from 'react-router-dom';

import type {ScheduledPost} from '@mattermost/types/schedule_post';
import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {
    isScheduledPostsEnabled,
    makeGetScheduledPostsByTeam,
} from 'mattermost-redux/selectors/entities/scheduled_posts';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import type {Draft} from 'selectors/drafts';

import DraftList from 'components/drafts/draft_list/draft_list';
import ScheduledPostList from 'components/drafts/scheduled_post_list/scheduled_post_list';
import Tab from 'components/tabs/tab';
import Tabs from 'components/tabs/tabs';
import Header from 'components/widgets/header';

import {SCHEDULED_POST_URL_SUFFIX} from 'utils/constants';

import type {GlobalState} from 'types/store';
import {LhsItemType, LhsPage} from 'types/store/lhs';

import './drafts.scss';

const EMPTY_LIST: ScheduledPost[] = [];

type Props = {
    drafts: Draft[];
    user: UserProfile;
    displayName: string;
    status: UserStatus['status'];
    draftRemotes: Record<string, boolean>;
}

function Drafts({
    displayName,
    drafts,
    draftRemotes,
    status,
    user,
}: Props) {
    const dispatch = useDispatch();

    const history = useHistory();
    const match: match<{team: string}> = useRouteMatch();
    const isDraftsTab = useRouteMatch('/:team/drafts');

    const isScheduledPostsTab = useRouteMatch('/:team/' + SCHEDULED_POST_URL_SUFFIX);

    const currentTeamId = useSelector(getCurrentTeamId);
    const getScheduledPostsByTeam = useMemo(() => makeGetScheduledPostsByTeam(), []);
    const scheduledPosts = useSelector((state: GlobalState) => getScheduledPostsByTeam(state, currentTeamId, true));
    const isScheduledPostEnabled = useSelector(isScheduledPostsEnabled);

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    const handleSwitchTabs = useCallback((key) => {
        if (key === 0 && isScheduledPostsTab) {
            history.push(`/${match.params.team}/drafts`);
        } else if (key === 1 && isDraftsTab) {
            history.push(`/${match.params.team}/scheduled_posts`);
        }
    }, [history, isDraftsTab, isScheduledPostsTab, match]);

    const scheduledPostsTabHeading = useMemo(() => {
        return (
            <div className='drafts_tab_title'>
                <FormattedMessage
                    id='schedule_post.tab.heading'
                    defaultMessage='Scheduled'
                />

                {
                    scheduledPosts?.length > 0 &&
                    <Badge
                        className='badge'
                        badgeContent={scheduledPosts.length}
                    />
                }
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

                {
                    drafts.length > 0 &&
                    <Badge
                        className='badge'
                        badgeContent={drafts.length}
                    />
                }
            </div>
        );
    }, [drafts?.length]);

    const heading = useMemo(() => {
        return (
            <FormattedMessage
                id='drafts.heading'
                defaultMessage='Drafts'
            />
        );
    }, []);

    const subtitle = useMemo(() => {
        return (
            <FormattedMessage
                id={'drafts.subtitle'}
                defaultMessage={'Any messages you\'ve started will show here'}
            />
        );
    }, []);

    const activeTab = isDraftsTab ? 0 : 1;

    return (
        <div
            id='app-content'
            className='Drafts app__content'
        >
            <Header
                level={2}
                className='Drafts__header'
                heading={heading}
                subtitle={subtitle}
            />

            {
                isScheduledPostEnabled &&
                <Tabs
                    id='draft_tabs'
                    activeKey={activeTab}
                    mountOnEnter={true}
                    unmountOnExit={false}
                    onSelect={handleSwitchTabs}
                >
                    <Tab
                        eventKey={0}
                        title={draftTabHeading}
                        unmountOnExit={false}
                        tabClassName='drafts_tab'
                        tabIndex={0}
                    >
                        <DraftList
                            drafts={drafts}
                            user={user}
                            displayName={displayName}
                            draftRemotes={draftRemotes}
                            status={status}
                        />
                    </Tab>

                    <Tab
                        eventKey={1}
                        title={scheduledPostsTabHeading}
                        unmountOnExit={false}
                        tabClassName='drafts_tab'
                    >
                        <ScheduledPostList
                            scheduledPosts={scheduledPosts || EMPTY_LIST}
                            user={user}
                            displayName={displayName}
                            status={status}
                        />
                    </Tab>
                </Tabs>
            }

            {
                !isScheduledPostEnabled &&
                <DraftList
                    drafts={drafts}
                    user={user}
                    displayName={displayName}
                    draftRemotes={draftRemotes}
                    status={status}
                />
            }
        </div>
    );
}

export default memo(Drafts);
