// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useCallback, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import styled from 'styled-components';

import Flex from '@mattermost/compass-components/utilities/layout/Flex'; // eslint-disable-line no-restricted-imports

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import {setAddChannelDropdown} from 'actions/views/add_channel_dropdown';
import {isAddChannelDropdownOpen} from 'selectors/views/add_channel_dropdown';

import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';
import CompassThemeProvider from 'components/compass_theme_provider/compass_theme_provider';
import MainMenu from 'components/main_menu';
import AddChannelDropdown from 'components/sidebar/add_channel_dropdown';
import {OnboardingTourSteps} from 'components/tours';
import {useShowOnboardingTutorialStep} from 'components/tours/onboarding_tour';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import './sidebar_header.scss';

import type {GlobalState} from 'types/store';

type SidebarHeaderContainerProps = {
    id?: string;
}

const SidebarHeaderContainer = styled(Flex).attrs(() => ({
    element: 'header',
    row: true,
    justify: 'space-between',
    alignment: 'center',
}))<SidebarHeaderContainerProps>`
    height: 55px;
    padding: 0 16px;
    gap: 8px;

    .dropdown-menu {
        position: absolute;
        transform: translate(0, 0);
        margin-left: 0;
        min-width: 210px;
    }

    #SidebarContainer & .AddChannelDropdown_dropdownButton {
        border-radius: 16px;
        font-size: 18px;
    }
`;

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
    const usageDeltas = useGetUsageDeltas();
    const isAddChannelOpen = useSelector(isAddChannelDropdownOpen);
    const theme = useSelector(getTheme);
    const openAddChannelOpen = useCallback((open: boolean) => {
        dispatch(setAddChannelDropdown(open));
    }, []);

    const [menuToggled, setMenuToggled] = useState(false);

    const handleMenuToggle = () => {
        setMenuToggled(!menuToggled);
    };

    if (!currentTeam) {
        return null;
    }

    return (
        <CompassThemeProvider theme={theme}>
            <SidebarHeaderContainer
                id={'sidebar-header-container'}
            >
                <MenuWrapper
                    onToggle={handleMenuToggle}
                    className='SidebarHeaderMenuWrapper test-team-header'
                >
                    <WithTooltip
                        title={currentTeam.description ? currentTeam.description : currentTeam.display_name}
                    >
                        <h1 className='sidebarHeader'>
                            <button className='style--none sidebar-header'>
                                <span className='title'>{currentTeam.display_name}</span>
                                <i className='icon icon-chevron-down'/>
                            </button>
                        </h1>
                    </WithTooltip>
                    <MainMenu
                        id='sidebarDropdownMenu'
                        usageDeltaTeams={usageDeltas.teams.active}
                    />
                </MenuWrapper>
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
            </SidebarHeaderContainer>
        </CompassThemeProvider>
    );
};

export default SidebarHeader;
