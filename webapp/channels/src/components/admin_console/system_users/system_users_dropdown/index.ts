// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {ActionFunc} from 'mattermost-redux/types/actions';

import {updateUserActive, revokeAllSessionsForUser, promoteGuestToUser, demoteUserToGuest} from 'mattermost-redux/actions/users';
import {getCurrentUser} from 'mattermost-redux/selectors/entities/users';
import {getExternalBotAccounts} from 'mattermost-redux/selectors/entities/bots';
import {loadBots} from 'mattermost-redux/actions/bots';
import {createGroupTeamsAndChannels} from 'mattermost-redux/actions/groups';

import {getLicense} from 'mattermost-redux/selectors/entities/general';

import * as Selectors from 'mattermost-redux/selectors/entities/admin';

import {GlobalState} from 'types/store';

import SystemUsersDropdown, {Props} from './system_users_dropdown';

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
