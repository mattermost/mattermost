// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentChannel} from 'mattermost-redux/selectors/entities/channels';

import {setRhsTab} from 'actions/views/guilded_layout';
import Constants from 'utils/constants';

import type {GlobalState} from 'types/store';

import RhsTabBar from './rhs_tab_bar';
import MembersTab from './members_tab';
import ThreadsTab from './threads_tab';
import GroupDmParticipants from './group_dm_participants';

import './persistent_rhs.scss';

export default function PersistentRhs() {
    const dispatch = useDispatch();

    const channel = useSelector(getCurrentChannel);
    const activeTab = useSelector((state: GlobalState) => state.views.guildedLayout.rhsActiveTab);

    const handleTabChange = useCallback((tab: 'members' | 'threads') => {
        dispatch(setRhsTab(tab));
    }, [dispatch]);

    // Hide for 1:1 DMs
    if (channel?.type === Constants.DM_CHANNEL) {
        return null;
    }

    // Show participants list for Group DMs
    if (channel?.type === Constants.GM_CHANNEL) {
        return (
            <div className='persistent-rhs persistent-rhs--group-dm'>
                <div className='persistent-rhs__header'>
                    <h3 className='persistent-rhs__title'>Participants</h3>
                </div>
                <GroupDmParticipants channelId={channel.id} />
            </div>
        );
    }

    // Regular channel - show Members/Threads tabs
    return (
        <div className='persistent-rhs'>
            <RhsTabBar
                activeTab={activeTab}
                onTabChange={handleTabChange}
            />
            <div className='persistent-rhs__content'>
                {activeTab === 'members' ? (
                    <MembersTab />
                ) : (
                    <ThreadsTab />
                )}
            </div>
        </div>
    );
}
