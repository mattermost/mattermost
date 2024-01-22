// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {sendWarnMetricAck} from 'mattermost-redux/actions/admin';
import {getFilteredUsersStats} from 'mattermost-redux/actions/users';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getFilteredUsersStats as selectFilteredUserStats} from 'mattermost-redux/selectors/entities/users';

import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import WarnMetricAckModal from './warn_metric_ack_modal';

type Props = {
    closeParentComponent: () => Promise<void>;
};

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const config = getConfig(state);

    return {
        totalUsers: selectFilteredUserStats(state)?.total_users_count || 0,
        user: getCurrentUser(state),
        telemetryId: config.DiagnosticId,
        show: isModalOpen(state, ModalIdentifiers.WARN_METRIC_ACK),
        closeParentComponent: ownProps.closeParentComponent,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators(
            {
                closeModal,
                sendWarnMetricAck,
                getFilteredUsersStats,
            },
            dispatch,
        ),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(WarnMetricAckModal);
