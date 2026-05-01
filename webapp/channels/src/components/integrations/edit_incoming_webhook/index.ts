// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getIncomingHook, updateIncomingHook} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';

import EditIncomingWebhook from './edit_incoming_webhook';

type Props = {
    location: Location;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const config = getConfig(state);
    const enableIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const enablePostUsernameOverride = config.EnablePostUsernameOverride === 'true';
    const enablePostIconOverride = config.EnablePostIconOverride === 'true';
    const hookId = (new URLSearchParams(ownProps.location.search)).get('id') || '';
    const canBypassChannelLock = haveICurrentTeamPermission(state, Permissions.BYPASS_INCOMING_WEBHOOK_CHANNEL_LOCK);

    return {
        hookId,
        hook: state.entities.integrations.incomingHooks[hookId],
        enableIncomingWebhooks,
        enablePostUsernameOverride,
        enablePostIconOverride,
        canBypassChannelLock,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateIncomingHook,
            getIncomingHook,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditIncomingWebhook);
