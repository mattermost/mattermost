// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {canManageChannelMembers} from 'mattermost-redux/selectors/entities/channels';

import {openModal} from 'actions/views/modals';

import ChannelMembersModal from './channel_members_modal';

import type {Action} from 'mattermost-redux/types/actions';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';
import type {ModalData} from 'types/actions';
import type {GlobalState} from 'types/store';

const mapStateToProps = (state: GlobalState) => ({
    canManageChannelMembers: canManageChannelMembers(state),
});

type Actions = {
    openModal: <P>(modalData: ModalData<P>) => void;
}

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({openModal}, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ChannelMembersModal);
