// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {canManageChannelMembers} from 'mattermost-redux/selectors/entities/channels';

import {openModal} from 'actions/views/modals';

import type {GlobalState} from 'types/store';

import ChannelMembersModal from './channel_members_modal';

const mapStateToProps = (state: GlobalState) => ({
    canManageChannelMembers: canManageChannelMembers(state),
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({openModal}, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ChannelMembersModal);
