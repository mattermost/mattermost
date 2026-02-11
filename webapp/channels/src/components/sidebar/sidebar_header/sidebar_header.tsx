// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useSelector} from 'react-redux';

import {
    PencilOutlineIcon,
    CheckIcon,
} from '@mattermost/compass-icons/components';

import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import SidebarBrowseOrAddChannelMenu from './sidebar_browse_or_add_channel_menu';
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
    handleOpenDirectMessagesModal: () => void;
    unreadFilterEnabled: boolean;
    canCreateCustomGroups: boolean;
    isAdmin: boolean;
    isChannelSyncEnabled: boolean;
    isSynced: boolean;
    isEditMode: boolean;
    onEditLayoutToggle: () => void;
}

const SidebarHeader = (props: Props) => {
    const currentTeam = useSelector(getCurrentTeam);

    if (!currentTeam) {
        return null;
    }

    return (
        <div className='sidebarHeaderContainer'>
            <SidebarTeamMenu currentTeam={currentTeam}/>
            {props.isAdmin && props.isChannelSyncEnabled && (
                <button
                    id='editTeamLayoutButton'
                    className={`btn btn-icon btn-sm btn-inverted btn-round ${props.isEditMode ? 'btn-primary' : 'btn-tertiary'}`}
                    aria-label={props.isEditMode ? 'Exit Layout Edit Mode' : 'Edit Team Layout'}
                    title={props.isEditMode ? 'Exit Layout Edit Mode' : 'Edit Team Layout'}
                    onClick={props.onEditLayoutToggle}
                >
                    {props.isEditMode ? <CheckIcon size={18}/> : <PencilOutlineIcon size={18}/>}
                </button>
            )}
            {!props.isEditMode && (props.canCreateChannel || props.canJoinPublicChannel) && (
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
                    isSynced={props.isSynced}
                />
            )}
        </div>
    );
};

export default SidebarHeader;
