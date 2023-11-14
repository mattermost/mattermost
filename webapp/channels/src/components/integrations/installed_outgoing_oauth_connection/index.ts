// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getUser} from 'mattermost-redux/selectors/entities/users';

import {getDisplayNameByUser} from 'utils/utils';

import type {GlobalState} from 'types/store';

import InstalledOutgoingOAuthConnection from './installed_outgoing_oauth_connection';
import type {InstalledOutgoingOAuthConnectionProps} from './installed_outgoing_oauth_connection';

function mapStateToProps(state: GlobalState, ownProps: InstalledOutgoingOAuthConnectionProps) {
    const oauthApp = ownProps.oauthApp || {};
    return {
        creatorName: getDisplayNameByUser(state, getUser(state, oauthApp.creator_id)),
    };
}

export default connect(mapStateToProps)(InstalledOutgoingOAuthConnection);
