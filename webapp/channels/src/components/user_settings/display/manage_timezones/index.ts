// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import timezones from 'timezones.json';

import type {GlobalState} from '@mattermost/types/store';
import type {UserProfile} from '@mattermost/types/users';

import {updateMe} from 'mattermost-redux/actions/users';
import {getCurrentTimezoneLabel} from 'mattermost-redux/selectors/entities/timezone';
import type {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';

import ManageTimezones from './manage_timezones';

type Actions = {
    updateMe: (user: UserProfile) => Promise<ActionResult>;
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            updateMe,
        }, dispatch)};
}
function mapStateToProps(state: GlobalState) {
    const timezoneLabel = getCurrentTimezoneLabel(state);
    return {
        timezones,
        timezoneLabel,
    };
}
export default connect(mapStateToProps, mapDispatchToProps)(ManageTimezones);

