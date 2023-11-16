// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import {addOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import AddOutgoingOAuthConnection from './add_outgoing_oauth_connection';
import type {Props} from './add_outgoing_oauth_connection';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            addOutgoingOAuthConnection,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(AddOutgoingOAuthConnection);
