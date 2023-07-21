// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {GlobalState} from '@mattermost/types/store';
import {connect} from 'react-redux';
import {bindActionCreators, Dispatch, ActionCreatorsMapObject} from 'redux';

import {deleteCommand, regenCommandToken} from 'mattermost-redux/actions/integrations';
import {Permissions} from 'mattermost-redux/constants';
import {haveITeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {GenericAction, ActionResult, ActionFunc} from 'mattermost-redux/types/actions';

import InstalledCommands from './installed_commands';

type Props = {
    team: {
        id: string;
    };
}

type Actions = {
    regenCommandToken: (id: string) => Promise<ActionResult>;
    deleteCommand: (id: string) => Promise<ActionResult>;
}

function mapStateToProps(state: GlobalState, ownProps: Props) {
    const canManageOthersSlashCommands = haveITeamPermission(state, ownProps.team.id, Permissions.MANAGE_OTHERS_SLASH_COMMANDS);

    return {
        canManageOthersSlashCommands,
    };
}

function mapDispatchToProps(dispatch: Dispatch<GenericAction>) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Actions>({
            regenCommandToken,
            deleteCommand,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(InstalledCommands);
