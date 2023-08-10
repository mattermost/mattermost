// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {getIncomingHook, updateIncomingHook} from 'mattermost-redux/actions/integrations';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import EditIncomingWebhook from './edit_incoming_webhook';

import type {IncomingWebhook} from '@mattermost/types/integrations';
import type {GlobalState} from '@mattermost/types/store';
import type {ActionFunc, ActionResult, GenericAction} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

type Props = {
    location: Location;
}

type Actions = {
    updateIncomingHook: (hook: IncomingWebhook) => Promise<ActionResult>;
    getIncomingHook: (hookId: string) => Promise<ActionResult>;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const config = getConfig(state);
    const enableIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const enablePostUsernameOverride = config.EnablePostUsernameOverride === 'true';
    const enablePostIconOverride = config.EnablePostIconOverride === 'true';
    const hookId = (new URLSearchParams(ownProps.location.search)).get('id') || '';

    return {
        hookId,
        hook: state.entities.integrations.incomingHooks[hookId],
        enableIncomingWebhooks,
        enablePostUsernameOverride,
        enablePostIconOverride,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            updateIncomingHook,
            getIncomingHook,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditIncomingWebhook);
