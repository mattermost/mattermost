// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import type {OutgoingOAuthConnection} from '@mattermost/types/integrations';
import type {GlobalState} from '@mattermost/types/store';

import {getOutgoingOAuthConnection, editOutgoingOAuthConnection} from 'mattermost-redux/actions/integrations';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import type {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import EditOutgoingOAuthConnection from './edit_outgoing_oauth_connection';

type Actions = {
    getOutgoingOAuthConnection: (id: string) => OutgoingOAuthConnection;
    editOutgoingOAuthConnection: (connection: OutgoingOAuthConnection) => Promise<ActionResult>;
};

type Props = {
    location: Location;
};

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const config = getConfig(state);
    const connectionId: string = (new URLSearchParams(ownProps.location.search)).get('id') || '';
    const enableOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';

    return {
        outgoingOAuthConnectionId: connectionId,
        outgoingOAuthConnection: state.entities.integrations.outgoingOAuthConnections[connectionId],
        enableOAuthServiceProvider,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            getOutgoingOAuthConnection,
            editOutgoingOAuthConnection,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(EditOutgoingOAuthConnection);
