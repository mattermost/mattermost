// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {sendWarnMetricAck} from 'mattermost-redux/actions/admin';
import {getFilteredUsersStats} from 'mattermost-redux/actions/users';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getFilteredUsersStats as selectFilteredUserStats} from 'mattermost-redux/selectors/entities/users';

import {closeModal} from 'actions/views/modals';
import {isModalOpen} from 'selectors/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import WarnMetricAckModal from './warn_metric_ack_modal';

import type {ServerError} from '@mattermost/types/errors';
import type {GetFilteredUsersStatsOpts, UsersStats} from '@mattermost/types/users';
import type {Action, ActionResult} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

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

type Actions = {
    closeModal: (modalId: string) => void;
    sendWarnMetricAck: (warnMetricId: string, forceAck: boolean) => Promise<ActionResult>;
    getFilteredUsersStats: (filters: GetFilteredUsersStatsOpts) => Promise<{ data?: UsersStats | undefined; error?: ServerError | undefined}>;
};

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>(
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
