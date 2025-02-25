// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useState} from 'react';
import {useSelector} from 'react-redux';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import useGetUsageDeltas from 'components/common/hooks/useGetUsageDeltas';
import MainMenu from 'components/main_menu';
import MenuWrapper from 'components/widgets/menu/menu_wrapper';
import WithTooltip from 'components/with_tooltip';

import SidebarBrowseOrAddChannelMenu from './sidebar_browse_or_add_channel_menu';

import './sidebar_header.scss';

export type Props = {
    showNewChannelModal: () => void;
    showMoreChannelsModal: () => void;
    showCreateUserGroupModal: () => void;
    invitePeopleModal: () => void;
    showCreateCategoryModal: () => void;
    canCreateChannel: boolean;
    canJoinPublicChannel: boolean;
    handleOpenDirectMessagesModal: () => void;
    unreadFilterEnabled: boolean;
    canCreateCustomGroups: boolean;
}

const SidebarHeader = (props: Props) => {
    const currentTeam = useSelector(getCurrentTeam);
    const usageDeltas = useGetUsageDeltas();

    const [menuToggled, setMenuToggled] = useState(false);

    const handleMenuToggle = () => {
        setMenuToggled(!menuToggled);
    };

    if (!currentTeam) {
        return null;
    }

    return (
        <header
            id='sidebar-header-container'
            className='sidebarHeaderContainer'
        >
            <MenuWrapper
                onToggle={handleMenuToggle}
                className='SidebarHeaderMenuWrapper test-team-header'
            >
                <WithTooltip
                    title={currentTeam.description ? currentTeam.description : currentTeam.display_name}
                >
                    <h1 className='sidebarHeader'>
                        <button
                            className='style--none sidebar-header'
                            type='button'
                            aria-haspopup='menu'
                            aria-expanded={menuToggled}
                            aria-controls='sidebarDropdownMenu'
                        >
                            <span className='title'>{currentTeam.display_name}</span>
                            <i
                                className='icon icon-chevron-down'
                                aria-hidden={true}
                            />
                        </button>
                    </h1>
                </WithTooltip>
                <MainMenu
                    id='sidebarDropdownMenu'
                    usageDeltaTeams={usageDeltas.teams.active}
                />
            </MenuWrapper>
            {(props.canCreateChannel || props.canJoinPublicChannel) && (
                <SidebarBrowseOrAddChannelMenu
                    canCreateChannel={props.canCreateChannel}
                    onCreateNewChannelClick={props.showNewChannelModal}
                    canJoinPublicChannel={props.canJoinPublicChannel}
                    onBrowseChannelClick={props.showMoreChannelsModal}
                    onOpenDirectMessageClick={props.handleOpenDirectMessagesModal}
                    canCreateCustomGroups={props.canCreateCustomGroups}
                    onCreateNewUserGroupClick={props.showCreateUserGroupModal}
                    unreadFilterEnabled={props.unreadFilterEnabled}
                    onCreateNewCategoryClick={props.showCreateCategoryModal}
                    onInvitePeopleClick={props.invitePeopleModal}
                />
            )}
        </header>
    );
};

export default SidebarHeader;
