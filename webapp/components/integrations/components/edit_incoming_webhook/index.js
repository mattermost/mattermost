// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {updateIncomingHook, getIncomingHook} from 'mattermost-redux/actions/integrations';

import EditIncomingWebhook from './edit_incoming_webhook.jsx';

function mapStateToProps(state, ownProps) {
    const hookId = ownProps.location.query.id;

    return {
        ...ownProps,
        hookId,
        hook: state.entities.integrations.incomingHooks[hookId],
        updateIncomingHookRequest: state.requests.integrations.createIncomingHook
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            updateIncomingHook,
            getIncomingHook
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditIncomingWebhook);