// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getMyChannelMember} from 'mattermost-redux/actions/channels';
import {getGroupsAssociatedToChannel, unlinkGroupSyncable, patchGroupSyncable} from 'mattermost-redux/actions/groups';

import {closeModal, openModal} from 'actions/views/modals';

import ChannelGroupsManageModal from './channel_groups_manage_modal';

const mapStateToProps = (state: GlobalState, ownProps: any) => {
    return {
        channel: state.entities.channels.channels[ownProps.channelID],
    };
};

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators(
        {
            getGroupsAssociatedToChannel,
            closeModal,
            openModal,
            unlinkGroupSyncable,
            patchGroupSyncable,
            getMyChannelMember,
        },
        dispatch,
    ),
});

export default connect(mapStateToProps, mapDispatchToProps)(ChannelGroupsManageModal);
