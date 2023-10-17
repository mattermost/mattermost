// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import type {Dispatch, ActionCreatorsMapObject} from 'redux';

import {loadBots} from 'mattermost-redux/actions/bots';
import {createGroupTeamsAndChannels} from 'mattermost-redux/actions/groups';
import {updateUserActive, revokeAllSessionsForUser, promoteGuestToUser, demoteUserToGuest} from 'mattermost-redux/actions/users';
import * as Selectors from 'mattermost-redux/selectors/entities/admin';
import {getExternalBotAccounts} from 'mattermost-redux/selectors/entities/bots';
import {getLicense} from 'mattermost-redux/selectors/entities/general';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import type {ActionFunc} from 'mattermost-redux/types/actions';

import type {GlobalState} from 'types/store';

import SystemUsersDropdown from './system_users_dropdown';
import type {Props} from './system_users_dropdown';

function mapStateToProps(state: GlobalState) {
    const bots = getExternalBotAccounts(state);
    const license = getLicense(state);
    return {
        isLicensed: license && license.IsLicensed === 'true',
        config: Selectors.getConfig(state),
        currentUser: getCurrentUser(state),
        bots,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            updateUserActive,
            revokeAllSessionsForUser,
            promoteGuestToUser,
            demoteUserToGuest,
            loadBots,
            createGroupTeamsAndChannels,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(SystemUsersDropdown);
