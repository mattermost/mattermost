// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {bindActionCreators, Dispatch} from 'redux';
import {connect} from 'react-redux';

import {showChannelMembers} from 'actions/views/rhs';
import {GenericAction} from 'mattermost-redux/types/actions';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {GlobalState} from 'types/store';
import {RHSStates} from 'utils/constants';

import OpenChannelMembersRHS from './open_members_rhs';

const mapStateToProps = (state: GlobalState) => ({
    rhsOpen: getIsRhsOpen(state) && getRhsState(state) === RHSStates.CHANNEL_MEMBERS,
});

const mapDispatchToProps = (dispatch: Dispatch<GenericAction>) => ({
    actions: bindActionCreators({
        showChannelMembers,
    }, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(OpenChannelMembersRHS);
