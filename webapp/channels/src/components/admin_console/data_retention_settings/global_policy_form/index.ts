// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {AdminConfig} from '@mattermost/types/config';
import type {ServerError} from '@mattermost/types/errors';

import {
    updateConfig,
} from 'mattermost-redux/actions/admin';
import type {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';
import {getDataRetentionTimeInHours} from 'mattermost-redux/utils/helpers';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import type {GlobalState} from 'types/store';

import GlobalPolicyForm from './global_policy_form';

type Actions = {
    updateConfig: (config: Record<string, any>) => Promise<{ data?: AdminConfig; error?: ServerError }>;
    setNavigationBlocked: (blocked: boolean) => void;
};

function mapStateToProps(state: GlobalState) {
    const messageRetentionHours = getDataRetentionTimeInHours(state.entities.admin.config.DataRetentionSettings?.MessageRetentionDays, state.entities.admin.config.DataRetentionSettings?.MessageRetentionHours);
    const fileRetentionHours = getDataRetentionTimeInHours(state.entities.admin.config.DataRetentionSettings?.MessageRetentionDays, state.entities.admin.config.DataRetentionSettings?.MessageRetentionHours);

    return {
        messageRetentionHours,
        fileRetentionHours,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc | GenericAction>, Actions>({
            updateConfig,
            setNavigationBlocked,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(GlobalPolicyForm);
