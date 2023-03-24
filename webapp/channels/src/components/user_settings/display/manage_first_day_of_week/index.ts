// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {ActionCreatorsMapObject, bindActionCreators, Dispatch} from 'redux';

import {updateMe} from 'mattermost-redux/actions/users';
import {ActionFunc, ActionResult} from 'mattermost-redux/types/actions';
import {UserProfile} from '@mattermost/types/users';
import {GlobalState} from '@mattermost/types/store';

import {daysOfWeek, getFirstDayOfWeekForCurrentUser} from 'mattermost-redux/selectors/entities/users';

import ManageFirstDayOfWeek from './manage_first_day_of_week';

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
    return {
        firstDayOfWeek: getFirstDayOfWeekForCurrentUser(state),
        daysOfWeek,
    };
}
export default connect(mapStateToProps, mapDispatchToProps)(ManageFirstDayOfWeek);
