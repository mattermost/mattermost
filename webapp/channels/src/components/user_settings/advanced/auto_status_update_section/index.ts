// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {PreferencesType} from '@mattermost/types/preferences';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences} from 'mattermost-redux/constants';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import AutoStatusUpdateSection from './auto_status_update_section';

export type OwnProps = {
    adminMode?: boolean;
    userId: string;
    userPreferences?: PreferencesType;
}

export function mapStateToProps(state: GlobalState, props: OwnProps) {
    const userPreference = props.adminMode && props.userPreferences ? props.userPreferences : undefined;

    return {
        userId: props.adminMode ? props.userId : getCurrentUserId(state),
        autoStatusUpdate: get(state, Preferences.CATEGORY_ADVANCED_SETTINGS, Preferences.ADVANCED_AUTO_STATUS_UPDATE, 'true', userPreference),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            savePreferences,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AutoStatusUpdateSection);
