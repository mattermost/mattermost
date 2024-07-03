// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {getUserVisibleDmGmLimit, getVisibleDmGmLimit} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import LimitVisibleGMsDMs, {OwnProps} from './limit_visible_gms_dms';

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    console.log('############################################');
    console.log({adminMode: ownProps.adminMode});
    console.log('############################################');

    return {
        currentUserId: ownProps.adminMode ? ownProps.currentUserId : getCurrentUserId(state),
        dmGmLimit: ownProps.adminMode && ownProps.userPreferences ? getUserVisibleDmGmLimit(ownProps.userPreferences) : getVisibleDmGmLimit(state),
    };
}

const mapDispatchToProps = {
    savePreferences,
};

export default connect(mapStateToProps, mapDispatchToProps)(LimitVisibleGMsDMs);
