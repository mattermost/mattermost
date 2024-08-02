// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';
import timezones from 'timezones.json';

import type {GlobalState} from '@mattermost/types/store';

import {patchUser, updateMe} from 'mattermost-redux/actions/users';
import {getCurrentTimezoneLabel} from 'mattermost-redux/selectors/entities/timezone';

import ManageTimezones from './manage_timezones';

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            updateMe,
            patchUser,
        }, dispatch),
    };
}
function mapStateToProps(state: GlobalState) {
    const timezoneLabel = getCurrentTimezoneLabel(state);
    return {
        timezones,
        timezoneLabel,
    };
}
export default connect(mapStateToProps, mapDispatchToProps)(ManageTimezones);

