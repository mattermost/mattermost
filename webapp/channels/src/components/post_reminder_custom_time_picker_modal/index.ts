// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {addPostReminder} from 'mattermost-redux/actions/posts';
import {Preferences} from 'mattermost-redux/constants';
import {getBool} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import {makeAsyncComponent} from 'components/async_load';

import type {GlobalState} from 'types/store';

const PostReminderCustomTimePicker = makeAsyncComponent('PostReminderCustomTimePicker', React.lazy(() => import('./post_reminder_custom_time_picker_modal')));

function mapStateToProps(state: GlobalState) {
    const timezone = getCurrentTimezone(state);
    const userId = getCurrentUserId(state);
    const isMilitaryTime = getBool(state, Preferences.CATEGORY_DISPLAY_SETTINGS, Preferences.USE_MILITARY_TIME, false);

    return {
        userId,
        timezone,
        isMilitaryTime,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            addPostReminder,
        }, dispatch),
    };
}
const connector = connect(mapStateToProps, mapDispatchToProps);
export type PropsFromRedux = ConnectedProps<typeof connector>;
export default connector(PostReminderCustomTimePicker);
