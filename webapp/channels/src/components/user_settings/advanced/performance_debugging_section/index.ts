// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {ConnectedProps} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences} from 'mattermost-redux/constants';
import {isPerformanceDebuggingEnabled} from 'mattermost-redux/selectors/entities/general';
import {getBool, getUserPreferences} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import type {OwnProps} from './performance_debugging_section';
import PerformanceDebuggingSection from './performance_debugging_section';

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const userPreferences = props.adminMode && props.userId ? getUserPreferences(state, props.userId) : undefined;

    return {
        userId: props.adminMode ? props.userId : getCurrentUserId(state),
        disableClientPlugins: getBool(state, Preferences.CATEGORY_PERFORMANCE_DEBUGGING, Preferences.NAME_DISABLE_CLIENT_PLUGINS, undefined, userPreferences),
        disableTelemetry: getBool(state, Preferences.CATEGORY_PERFORMANCE_DEBUGGING, Preferences.NAME_DISABLE_TELEMETRY, undefined, userPreferences),
        disableTypingMessages: getBool(state, Preferences.CATEGORY_PERFORMANCE_DEBUGGING, Preferences.NAME_DISABLE_TYPING_MESSAGES, undefined, userPreferences),
        performanceDebuggingEnabled: isPerformanceDebuggingEnabled(state),

    };
}

const mapDispatchToProps = {
    savePreferences,
};

const connector = connect(mapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(PerformanceDebuggingSection);
