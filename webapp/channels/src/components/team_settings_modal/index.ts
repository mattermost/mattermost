// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {Permissions} from 'mattermost-redux/constants';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';

import {isModalOpen} from 'selectors/views/modals';

import {ModalIdentifiers} from 'utils/constants';

import type {GlobalState} from 'types/store';

import TeamSettingsModal from './team_settings_modal';

function mapStateToProps(state: GlobalState) {
    const teamId = getCurrentTeamId(state);
    const canInviteUsers = haveITeamPermission(state, teamId, Permissions.INVITE_USER);
    const modalId = ModalIdentifiers.TEAM_SETTINGS;
    return {
        show: isModalOpen(state, modalId),
        canInviteUsers,
    };
}

export default connect(mapStateToProps)(TeamSettingsModal);
