// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {addChannelMember, getChannelMember, autocompleteChannelsForSearch} from 'mattermost-redux/actions/channels';
import {getChannelMembersInChannels} from 'mattermost-redux/selectors/entities/channels';

import {GlobalState} from '@mattermost/types/store';

import {ActionFunc} from 'mattermost-redux/types/actions';

import AddUserToChannelModal, {Props} from './add_user_to_channel_modal';

function mapStateToProps(state: GlobalState) {
    const channelMembers = getChannelMembersInChannels(state) || {};
    return {
        channelMembers,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            addChannelMember,
            getChannelMember,
            autocompleteChannelsForSearch,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddUserToChannelModal);
