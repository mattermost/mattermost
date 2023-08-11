// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {ActionFunc} from 'mattermost-redux/types/actions';

import {joinChannelById, switchToChannel} from 'actions/views/channel';
import {closeRightHandSide} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import QuickSwitchModal from './quick_switch_modal';
import type {Props} from './quick_switch_modal';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
        rhsState: getRhsState(state),
        rhsOpen: getIsRhsOpen(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            joinChannelById,
            switchToChannel,
            closeRightHandSide,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(QuickSwitchModal);
