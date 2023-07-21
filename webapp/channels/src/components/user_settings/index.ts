// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {connect} from 'react-redux';

import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';

import UserSettings from './user_settings';

function mapStateToProps(state: GlobalState) {
    return {
        user: getCurrentUser(state),
    };
}

export default connect(mapStateToProps)(UserSettings);
