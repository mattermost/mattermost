// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

import type {UserProfile} from '@mattermost/types/users';

import {updateMe} from 'mattermost-redux/actions/users';
import type {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import ManageLanguages from './manage_languages';

type Actions = {
    updateMe: (user: UserProfile) => Promise<ActionResult>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            updateMe,
        }, dispatch)};
}

export default connect(null, mapDispatchToProps)(ManageLanguages);
