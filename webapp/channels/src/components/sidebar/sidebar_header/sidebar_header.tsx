// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setAddChannelDropdown} from 'actions/views/add_channel_dropdown';
import {isAddChannelDropdownOpen} from 'selectors/views/add_channel_dropdown';

import AddChannelDropdown from 'components/sidebar/add_channel_dropdown';
import {OnboardingTourSteps} from 'components/tours';
import {useShowOnboardingTutorialStep} from 'components/tours/onboarding_tour';

import type {GlobalState} from 'types/store';

import SidebarTeamMenu from './sidebar_team_menu';

import './sidebar_header.scss';

export type Props = {
    showNewChannelModal: () => void;
    showMoreChannelsModal: () => void;
    showCreateUserGroupModal: () => void;
    invitePeopleModal: () => void;
    showCreateCategoryModal: () => void;
    canCreateChannel: boolean;
    canJoinPublicChannel: boolean;
    handleOpenDirectMessagesModal: (e: Event) => void;
    unreadFilterEnabled: boolean;
    userGroupsEnabled: boolean;
    canCreateCustomGroups: boolean;
}

const SidebarHeader = (props: Props) => {
    const dispatch = useDispatch();
    const currentTeam = useSelector((state: GlobalState) => getCurrentTeam(state));
    const showCreateTutorialTip = useShowOnboardingTutorialStep(OnboardingTourSteps.CREATE_AND_JOIN_CHANNELS);
    const showInviteTutorialTip = useShowOnboardingTutorialStep(OnboardingTourSteps.INVITE_PEOPLE);
    const isAddChannelOpen = useSelector(isAddChannelDropdownOpen);
    const openAddChannelOpen = useCallback((open: boolean) => {
        dispatch(setAddChannelDropdown(open));
    }, []);

    if (!currentTeam) {
        return null;
    }

    return (
        <header className='sidebarHeaderContainer'>
            <SidebarTeamMenu currentTeam={currentTeam}/>
            <AddChannelDropdown
                showNewChannelModal={props.showNewChannelModal}
                showMoreChannelsModal={props.showMoreChannelsModal}
                invitePeopleModal={props.invitePeopleModal}
                showCreateCategoryModal={props.showCreateCategoryModal}
                canCreateChannel={props.canCreateChannel}
                canJoinPublicChannel={props.canJoinPublicChannel}
                handleOpenDirectMessagesModal={props.handleOpenDirectMessagesModal}
                unreadFilterEnabled={props.unreadFilterEnabled}
                showCreateTutorialTip={showCreateTutorialTip}
                showInviteTutorialTip={showInviteTutorialTip}
                isAddChannelOpen={isAddChannelOpen}
                openAddChannelOpen={openAddChannelOpen}
                canCreateCustomGroups={props.canCreateCustomGroups}
                showCreateUserGroupModal={props.showCreateUserGroupModal}
                userGroupsEnabled={props.userGroupsEnabled}
            />
        </header>
    );
};

export default SidebarHeader;
