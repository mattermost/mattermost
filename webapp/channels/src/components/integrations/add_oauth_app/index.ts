// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import {addOAuthApp} from 'mattermost-redux/actions/integrations';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import AddOAuthApp from './add_oauth_app';
import type {Props} from './add_oauth_app';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            addOAuthApp,
        }, dispatch),
    };
}

export default connect(null, mapDispatchToProps)(AddOAuthApp);
