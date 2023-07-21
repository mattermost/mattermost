// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch} from 'redux';

import {closeRightHandSide, showChannelInfo} from 'actions/views/rhs';
import {GenericAction} from 'mattermost-redux/types/actions';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {GlobalState} from 'types/store';
import {RHSStates} from 'utils/constants';

import ToggleInfo from './toggle_info';

const mapStateToProps = (state: GlobalState) => ({
    rhsOpen: getIsRhsOpen(state) && getRhsState(state) === RHSStates.CHANNEL_INFO,
});

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators({
        closeRightHandSide,
        showChannelInfo,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(ToggleInfo);
