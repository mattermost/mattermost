// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/common';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {isGuest} from 'mattermost-redux/utils/user_utils';

import ErrorPage from './error_page';

import type {GlobalState} from 'types/store';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const user = getCurrentUser(state);

    return {
        siteName: config.SiteName,
        asymmetricSigningPublicKey: config.AsymmetricSigningPublicKey,
        isGuest: Boolean(user && isGuest(user.roles)),
    };
}

export default connect(mapStateToProps)(ErrorPage);
