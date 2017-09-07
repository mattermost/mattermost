// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import * as Actions from 'mattermost-redux/actions/integrations';
import {getIncomingHooks} from 'mattermost-redux/selectors/entities/integrations';
import InstalledIncomingWebhooks from './installed_incoming_webhooks.jsx';
import {getAllChannels} from 'mattermost-redux/selectors/entities/channels';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        incomingWebhooks: getIncomingHooks(state),
        channels: getAllChannels(state),
        users: getUsers(state)
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getIncomingHooks: Actions.getIncomingHooks,
            removeIncomingHook: Actions.removeIncomingHook
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledIncomingWebhooks);
