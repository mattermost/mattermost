// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {Channel} from '@mattermost/types/channels';

import {withdrawMyChannelJoinRequest} from 'mattermost-redux/actions/channels';

import {joinChannelById, switchToChannel} from 'actions/views/channel';
import {openModal} from 'actions/views/modals';
import {closeRightHandSide} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import RequestJoinChannelModal from 'components/request_join_channel_modal/request_join_channel_modal';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import QuickSwitchModal from './quick_switch_modal';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
        rhsState: getRhsState(state),
        rhsOpen: getIsRhsOpen(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    const boundActions = bindActionCreators({
        joinChannelById,
        switchToChannel,
        closeRightHandSide,
        withdrawJoinRequest: withdrawMyChannelJoinRequest,
    }, dispatch);

    return {
        actions: {
            ...boundActions,
            openRequestJoinModal: (channel: Channel) => {
                dispatch(openModal({
                    modalId: ModalIdentifiers.REQUEST_JOIN_CHANNEL,
                    dialogType: RequestJoinChannelModal,
                    dialogProps: {channel},
                }));
            },
        },
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(QuickSwitchModal);
