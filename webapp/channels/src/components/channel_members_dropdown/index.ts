// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getChannelStats, updateChannelMemberSchemeRoles, removeChannelMember, getChannelMember} from 'mattermost-redux/actions/channels';
import {Permissions} from 'mattermost-redux/constants';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';

import {canManageMembers} from 'utils/channel_utils';

import ChannelMembersDropdown from './channel_members_dropdown';

import type {Channel} from '@mattermost/types/channels';
import type {Action} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, AnyAction, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

interface OwnProps {
    channel: Channel;
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const {channel} = ownProps;
    const canChangeMemberRoles = haveIChannelPermission(
        state,
        channel.team_id,
        channel.id,
        Permissions.MANAGE_CHANNEL_ROLES,
    ) && canManageMembers(state, channel);
    const canRemoveMember = canManageMembers(state, channel);

    return {
        currentUserId: getCurrentUserId(state),
        canChangeMemberRoles,
        canRemoveMember,
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, any>({
            getChannelMember,
            getChannelStats,
            updateChannelMemberSchemeRoles,
            removeChannelMember,
            openModal,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(ChannelMembersDropdown);
