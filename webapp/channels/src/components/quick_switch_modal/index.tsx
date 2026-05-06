// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {getRecommendedChannelsForUser} from 'mattermost-redux/actions/channels';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {joinChannelById, switchToChannel} from 'actions/views/channel';
import {closeRightHandSide} from 'actions/views/rhs';
import {isChannelAccessControlEnabled} from 'selectors/general';
import {getIsRhsOpen, getRhsState} from 'selectors/rhs';
import {getIsMobileView} from 'selectors/views/browser';

import type {GlobalState} from 'types/store';

import QuickSwitchModal from './quick_switch_modal';

function mapStateToProps(state: GlobalState) {
    return {
        isMobileView: getIsMobileView(state),
        rhsState: getRhsState(state),
        rhsOpen: getIsRhsOpen(state),

        // Used to decide whether to fetch the per-team recommendation set on
        // mount. The action short-circuits server-side when ABAC is off, but
        // skipping the round-trip on the client too keeps the switcher's
        // open-time cheap on non-Enterprise installations.
        accessControlEnabled: isChannelAccessControlEnabled(state),
        currentTeamId: getCurrentTeamId(state),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            joinChannelById,
            switchToChannel,
            closeRightHandSide,
            getRecommendedChannelsForUser,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(QuickSwitchModal);
