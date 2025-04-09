// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {ConnectedProps} from 'react-redux';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import {Client4} from 'mattermost-redux/client';
import {Preferences} from 'mattermost-redux/constants';
import {get} from 'mattermost-redux/selectors/entities/preferences';
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';
import {getCurrentUser, getStatusForUserId} from 'mattermost-redux/selectors/entities/users';

import {openModal} from 'actions/views/modals';
import {makeGetCustomStatus, isCustomStatusExpired, isCustomStatusEnabled} from 'selectors/views/custom_status';

import type {GlobalState} from 'types/store';

import UserAccountMenu from './user_account_menu';

function makeMapStateToProps() {
    const getCustomStatus = makeGetCustomStatus();

    return function mapStateToProps(state: GlobalState) {
        const currentUser = getCurrentUser(state);
        const userId = currentUser?.id;
        const username = currentUser?.username;
        const userFirstName = currentUser?.first_name;
        const userLastName = currentUser?.last_name;
        const customStatus = getCustomStatus(state, userId);

        return {
            userId,
            username,
            userFirstName,
            userLastName,
            profilePicture: Client4.getProfilePictureUrl(userId, currentUser?.last_picture_update),
            autoResetPref: get(state, Preferences.CATEGORY_AUTO_RESET_MANUAL_STATUS, userId, ''),
            status: getStatusForUserId(state, userId),
            customStatus,
            isCustomStatusExpired: isCustomStatusExpired(state, customStatus),
            isCustomStatusEnabled: isCustomStatusEnabled(state),
            timezone: getCurrentTimezone(state),
        };
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            openModal,
        }, dispatch),
    };
}

const connector = connect(makeMapStateToProps, mapDispatchToProps);

export type PropsFromRedux = ConnectedProps<typeof connector>;

export default connector(UserAccountMenu);
