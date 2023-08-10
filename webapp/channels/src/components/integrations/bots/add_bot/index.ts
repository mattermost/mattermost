// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';

import {createBot, patchBot} from 'mattermost-redux/actions/bots';
import {updateUserRoles, uploadProfileImage, setDefaultProfileImage, createUserAccessToken} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';
import {getBotAccounts} from 'mattermost-redux/selectors/entities/bots';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getUser} from 'mattermost-redux/selectors/entities/users';

import AddBot from './add_bot';

import type {Props} from './add_bot';
import type {ActionFunc} from 'mattermost-redux/types/actions';
import type {RouteComponentProps} from 'react-router-dom';
import type {ActionCreatorsMapObject, Dispatch} from 'redux';
import type {GlobalState} from 'types/store';

type OwnProps = {

    /**
     * Search query for the bot
     */
    location: RouteComponentProps['location'];
}

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const botId = (new URLSearchParams(ownProps.location.search)).get('id');
    const bots = getBotAccounts(state);
    const bot = (bots && botId) ? bots[botId] : undefined;
    const user = bot ? getUser(state, bot.user_id) : undefined;
    const roles = user ? user.roles : undefined;
    return {
        maxFileSize: parseInt(config.MaxFileSize!, 10),
        bot,
        roles,
        editingUserHasManageSystem: haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}),
        user,
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators<ActionCreatorsMapObject<ActionFunc>, Props['actions']>({
            createBot,
            patchBot,
            uploadProfileImage,
            setDefaultProfileImage,
            createUserAccessToken,
            updateUserRoles,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddBot);
