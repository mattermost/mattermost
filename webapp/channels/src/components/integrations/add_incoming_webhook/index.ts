// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {createIncomingHook} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';

import AddIncomingWebhook from './add_incoming_webhook';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const enablePostUsernameOverride = config.EnablePostUsernameOverride === 'true';
    const enablePostIconOverride = config.EnablePostIconOverride === 'true';
    const canBypassChannelLock = haveICurrentTeamPermission(state, Permissions.BYPASS_INCOMING_WEBHOOK_CHANNEL_LOCK);

    return {
        enablePostUsernameOverride,
        enablePostIconOverride,
        canBypassChannelLock,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createIncomingHook,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddIncomingWebhook);
