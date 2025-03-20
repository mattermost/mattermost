// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {savePreferences} from 'mattermost-redux/actions/preferences';
import {
    shouldShowUnreadsCategory,
} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import type {GlobalState} from 'types/store';

import type {OwnProps} from './show_unreads_category';
import ShowUnreadsCategory from './show_unreads_category';

function mapStateToProps(state: GlobalState, props: OwnProps) {
    const userPreferences = props.adminMode && props.userPreferences ? props.userPreferences : undefined;
    return {
        userId: props.adminMode ? props.userId : getCurrentUserId(state),
        showUnreadsCategory: shouldShowUnreadsCategory(state, userPreferences),
    };
}

const mapDispatchToProps = {
    savePreferences,
};

export default connect(mapStateToProps, mapDispatchToProps)(ShowUnreadsCategory);
