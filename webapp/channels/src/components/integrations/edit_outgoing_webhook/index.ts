// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getOutgoingHook, updateOutgoingHook} from 'mattermost-redux/actions/integrations';
import {getConfig} from 'mattermost-redux/selectors/entities/general';

import EditOutgoingWebhook from './edit_outgoing_webhook';

type OwnProps = {
    location: {
        search: string | string[][] | Record<string, string> | URLSearchParams | undefined;
    };
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const hookId = (new URLSearchParams(ownProps.location.search)).get('id');
    const enableOutgoingWebhooks = config.EnableOutgoingWebhooks === 'true';
    const enablePostUsernameOverride = config.EnablePostUsernameOverride === 'true';
    const enablePostIconOverride = config.EnablePostIconOverride === 'true';

    return {
        hookId: hookId!,
        hook: state.entities.integrations.outgoingHooks[hookId!],
        enableOutgoingWebhooks,
        enablePostUsernameOverride,
        enablePostIconOverride,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateOutgoingHook,
            getOutgoingHook,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditOutgoingWebhook);
