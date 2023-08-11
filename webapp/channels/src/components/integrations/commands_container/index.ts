// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';

import {bindActionCreators} from 'redux';
import type {AnyAction, Dispatch} from 'redux';

import type {GlobalState} from '@mattermost/types/store';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {getCommands} from 'mattermost-redux/selectors/entities/integrations';
import {getUsers} from 'mattermost-redux/selectors/entities/users';

import {loadCommandsAndProfilesForTeam} from 'actions/integration_actions';

import CommandsContainer from './commands_container';

function mapStateToProps(state: GlobalState) {
    const config = getConfig(state);
    const enableCommands = config.EnableCommands === 'true';

    return {
        commands: Object.values(getCommands(state)),
        users: getUsers(state),
        enableCommands,
    };
}

function mapDispatchToProps(dispatch: Dispatch<AnyAction>) {
    return {
        actions: bindActionCreators({
            loadCommandsAndProfilesForTeam,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(CommandsContainer);
