// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {createIncomingHook} from 'mattermost-redux/actions/integrations';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import AddIncomingWebhook from './add_incoming_webhook';

import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {GlobalState} from '@mattermost/types/store';
import type {Action, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const enablePostUsernameOverride = config.EnablePostUsernameOverride === 'true';
    const enablePostIconOverride = config.EnablePostIconOverride === 'true';

    return {
        enablePostUsernameOverride,
        enablePostIconOverride,
    };
}

type Actions = {
    createIncomingHook: (hook: IncomingWebhook) => Promise<{ data?: IncomingWebhook; error?: Error }>;
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<Action>, Actions>({
            createIncomingHook,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddIncomingWebhook);
