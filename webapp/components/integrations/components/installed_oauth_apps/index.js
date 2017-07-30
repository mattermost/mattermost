// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import * as Actions from 'mattermost-redux/actions/integrations';
import {getOAuthApps} from 'mattermost-redux/selectors/entities/integrations';
import {isCurrentUserSystemAdmin} from 'mattermost-redux/selectors/entities/users';

import InstalledOAuthApps from './installed_oauth_apps.jsx';

function mapStateToProps(state, ownProps) {
    return {
        ...ownProps,
        oauthApps: getOAuthApps(state),
        isSystemAdmin: isCurrentUserSystemAdmin(state)
    };
}

function mapDispatchToProps(dispatch) {
    return {
        actions: bindActionCreators({
            getOAuthApps: Actions.getOAuthApps,
            deleteOAuthApp: Actions.deleteOAuthApp
        }, dispatch)
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledOAuthApps);