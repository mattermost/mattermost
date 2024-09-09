// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo, useEffect} from 'react';
import {useIntl} from 'react-intl';
import {useDispatch} from 'react-redux';

import type {UserProfile, UserStatus} from '@mattermost/types/users';

import {selectLhsItem} from 'actions/views/lhs';
import {suppressRHS, unsuppressRHS} from 'actions/views/rhs';
import type {Draft} from 'selectors/drafts';

import DraftList from 'components/drafts/draft_list/draft_list';
import ScheduledPostList from 'components/drafts/scheduled_post_list';
import Tab from 'components/tabs/tab';
import Tabs from 'components/tabs/tabs';
import Header from 'components/widgets/header';

import {LhsItemType, LhsPage} from 'types/store/lhs';

import './drafts.scss';

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
    const {formatMessage} = useIntl();

    useEffect(() => {
        dispatch(selectLhsItem(LhsItemType.Page, LhsPage.Drafts));
        dispatch(suppressRHS);

        return () => {
            dispatch(unsuppressRHS);
        };
    }, [dispatch]);

    return (
        <div
            id='app-content'
            className='Drafts app__content'
        >
            <Header
                level={2}
                className='Drafts__header'
                heading={formatMessage({
                    id: 'drafts.heading',
                    defaultMessage: 'Drafts',
                })}
                subtitle={formatMessage({
                    id: 'drafts.subtitle',
                    defaultMessage: 'Any messages you\'ve started will show here',
                })}
            />

            <Tabs
                id='draft_tabs'
                defaultActiveKey={0}
                mountOnEnter={true}
                unmountOnExit={false}
            >
                <Tab
                    eventKey={0}
                    title='Drafts'
                    unmountOnExit={false}
                    tabClassName='drafts_tab'
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
                    title='Scheduled'
                    unmountOnExit={false}
                    tabClassName='drafts_tab'
                >
                    <ScheduledPostList/>
                </Tab>
            </Tabs>
        </div>
    );
}

export default memo(Drafts);
