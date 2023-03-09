// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, AnyAction, bindActionCreators, Dispatch} from 'redux';

import {getChannelStats, updateChannelMemberSchemeRoles, removeChannelMember, getChannelMember} from 'mattermost-redux/actions/channels';
import {haveIChannelPermission} from 'mattermost-redux/selectors/entities/roles';
import {Permissions} from 'mattermost-redux/constants';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';
import {canManageMembers} from 'utils/channel_utils';
import {GlobalState} from 'types/store';
import {Channel} from '@mattermost/types/channels';
import {openModal} from 'actions/views/modals';

import {Action} from 'mattermost-redux/types/actions';

import ChannelMembersDropdown from './channel_members_dropdown';

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
