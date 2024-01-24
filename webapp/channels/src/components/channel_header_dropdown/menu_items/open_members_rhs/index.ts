// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {showChannelMembers} from 'actions/views/rhs';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';

import {RHSStates} from 'utils/constants';

import type {GlobalState} from 'types/store';

import OpenChannelMembersRHS from './open_members_rhs';

const mapStateToProps = (state: GlobalState) => ({
    rhsOpen: getIsRhsOpen(state) && getRhsState(state) === RHSStates.CHANNEL_MEMBERS,
});

const mapDispatchToProps = (dispatch: Dispatch) => ({
    actions: bindActionCreators({
        showChannelMembers,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(OpenChannelMembersRHS);
