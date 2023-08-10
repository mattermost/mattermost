// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {autocompleteUsers} from 'actions/user_actions';

import UserAutocompleteSetting from './user_autocomplete_setting';

import type {Props} from './user_autocomplete_setting';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            autocompleteUsers,
        }, dispatch),
    };
}
export default connect(null, mapDispatchToProps)(UserAutocompleteSetting);
