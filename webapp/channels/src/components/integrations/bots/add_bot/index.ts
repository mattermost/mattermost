// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {connect} from 'react-redux';
import type {RouteComponentProps} from 'react-router-dom';
import {bindActionCreators} from 'redux';
import type {Dispatch} from 'redux';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import {createBot, createBotWithEventSubscription, deleteBotEventSubscription, getBotEventSubscription, patchBot, upsertBotEventSubscription} from 'mattermost-redux/actions/bots';
import {getCustomProfileAttributeFields} from 'mattermost-redux/actions/general';
import {updateUserRoles, uploadProfileImage, setDefaultProfileImage, createUserAccessToken, getCustomProfileAttributeValues, updateUserCustomProfileAttributeValues} from 'mattermost-redux/actions/users';
import {Permissions} from 'mattermost-redux/constants';
import {getBotAccounts} from 'mattermost-redux/selectors/entities/bots';
import {getConfig, getCustomProfileAttributes, getLicense} from 'mattermost-redux/selectors/entities/general';
import {haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentUserId, getUser} from 'mattermost-redux/selectors/entities/users';

import {isEnterpriseLicense} from 'utils/license_utils';

import type {GlobalState} from 'types/store';

import AddBot from './add_bot';
import {canManageBotAttributes} from './bot_attributes';

const EMPTY_FIELDS: UserPropertyField[] = [];

type OwnProps = {

    /**
     * Search query for the bot
     */
    location: RouteComponentProps['location'];
};

function mapStateToProps(state: GlobalState, ownProps: OwnProps) {
    const config = getConfig(state);
    const botId = (new URLSearchParams(ownProps.location.search)).get('id');
    const bots = getBotAccounts(state);
    const bot = (bots && botId) ? bots[botId] : undefined;
    const user = bot ? getUser(state, bot.user_id) : undefined;
    const roles = user ? user.roles : undefined;
    const maxLifetimeDays = parseInt(config.MaximumPersonalAccessTokenLifetimeDays || '0', 10);
    const attributesEnabled = isEnterpriseLicense(getLicense(state)) && canManageBotAttributes(bot, getCurrentUserId(state), {
        manageBots: haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS}),
        manageOthersBots: haveISystemPermission(state, {permission: Permissions.MANAGE_OTHERS_BOTS}),
    });
    const eventDeliveryEnabled = bot ? true : haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS});
    return {
        maxFileSize: parseInt(config.MaxFileSize!, 10),
        maxLifetimeDays: Number.isFinite(maxLifetimeDays) ? maxLifetimeDays : 0,
        bot,
        roles,
        editingUserHasManageSystem: haveISystemPermission(state, {permission: Permissions.MANAGE_SYSTEM}),
        user,
        attributesEnabled,
        eventDeliveryEnabled,
        attributeFields: attributesEnabled ? getCustomProfileAttributes(state) : EMPTY_FIELDS,
        canManageRoles: haveISystemPermission(state, {permission: Permissions.MANAGE_ROLES}),
    };
}

function mapDispatchToProps(dispatch: Dispatch) {
    return {
        actions: bindActionCreators({
            createBot,
            createBotWithEventSubscription,
            patchBot,
            uploadProfileImage,
            setDefaultProfileImage,
            createUserAccessToken,
            updateUserRoles,
            getCustomProfileAttributeFields,
            getCustomProfileAttributeValues,
            updateUserCustomProfileAttributeValues,
            getBotEventSubscription,
            upsertBotEventSubscription,
            deleteBotEventSubscription,
        }, dispatch),
    };
}

export default connect(mapStateToProps, mapDispatchToProps)(AddBot);
