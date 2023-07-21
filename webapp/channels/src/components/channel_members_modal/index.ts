// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {openModal} from 'actions/views/modals';
import {canManageChannelMembers} from 'mattermost-redux/selectors/entities/channels';
import {Action} from 'mattermost-redux/types/actions';

import {ModalData} from 'types/actions';
import {GlobalState} from 'types/store';

import ChannelMembersModal from './channel_members_modal';

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
