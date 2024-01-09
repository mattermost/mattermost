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
import {getEnvironmentConfig} from 'mattermost-redux/selectors/entities/admin';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import type {GenericAction, ActionFunc} from 'mattermost-redux/types/actions';

import {setNavigationBlocked} from 'actions/admin_actions.jsx';

import type {GlobalState} from 'types/store';

import GlobalPolicyForm from './global_policy_form';

type Actions = {
    updateConfig: (config: Record<string, any>) => Promise<{ data?: AdminConfig; error?: ServerError }>;
    setNavigationBlocked: (blocked: boolean) => void;
};

function mapStateToProps(state: GlobalState) {
    const messageRetentionHours = getConfig(state).DataRetentionMessageRetentionHours;
    const fileRetentionHours = getConfig(state).DataRetentionFileRetentionHours;

    return {
        messageRetentionHours,
        fileRetentionHours,
        environmentConfig: getEnvironmentConfig(state),
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
