// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {
    calculateUserShouldShowUnreadsCategory,
    shouldShowUnreadsCategory,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import type {OwnProps} from './show_unreads_category';
import ShowUnreadsCategory from './show_unreads_category';

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const serverDefault = getConfig(state).ExperimentalGroupUnreadChannels;
    return {
        currentUserId: props.adminMode ? props.currentUserId : getCurrentUserId(state),
        showUnreadsCategory: props.adminMode && props.userPreferences ? calculateUserShouldShowUnreadsCategory(props.userPreferences, serverDefault) : shouldShowUnreadsCategory(state),
    };
}

const mapDispatchToProps = {
    savePreferences,
};

export default connect(mapStateToProps, mapDispatchToProps)(ShowUnreadsCategory);
