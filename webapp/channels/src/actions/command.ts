// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import type {AppCallResponse} from '@mattermost/types/apps';
import type {CommandArgs, CommandResponse} from '@mattermost/types/integrations';

import {IntegrationTypes} from 'mattermost-redux/action_types';
import {unfavoriteChannel} from 'mattermost-redux/actions/channels';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Client4} from 'mattermost-redux/client';
import {Permissions} from 'mattermost-redux/constants';
import {AppCallResponseTypes} from 'mattermost-redux/constants/apps';
import {appsEnabled} from 'mattermost-redux/selectors/entities/apps';
import {getCurrentChannel, getRedirectChannelNameForTeam, isFavoriteChannel} from 'mattermost-redux/selectors/entities/channels';
import {isMarketplaceEnabled} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentRelativeTeamUrl, getCurrentTeamId} from 'mattermost-redux/selectors/entities/teams';
import {getCurrentUserId} from 'mattermost-redux/selectors/entities/users';

import * as GlobalActions from 'actions/global_actions';
import * as PostActions from 'actions/post_actions';
import {openModal} from 'actions/views/modals';

import KeyboardShortcutsModal from 'components/keyboard_shortcuts/keyboard_shortcuts_modal/keyboard_shortcuts_modal';
import LeaveChannelModal from 'components/leave_channel_modal';
import MarketplaceModal from 'components/plugin_marketplace/marketplace_modal';
import {AppCommandParser} from 'components/suggestion/command_provider/app_command_parser/app_command_parser';
import {intlShim} from 'components/suggestion/command_provider/app_command_parser/app_command_parser_dependencies';
import UserSettingsModal from 'components/user_settings/modal';

import {getHistory} from 'utils/browser_history';
import {Constants, ModalIdentifiers} from 'utils/constants';
import {isUrlSafe, getSiteURL} from 'utils/url';
import * as UserAgent from 'utils/user_agent';
import {localizeMessage, getUserIdFromChannelName} from 'utils/utils';

import type {ActionFuncAsync} from 'types/store';

import {doAppSubmit, openAppsModal, postEphemeralCallResponseForCommandArgs} from './apps';
import {trackEvent} from './telemetry_actions';

export type ExecuteCommandReturnType = {
    frontendHandled?: boolean;
    silentFailureReason?: Error;
    commandResponse?: CommandResponse;
    appResponse?: AppCallResponse;
}

export function executeCommand(message: string, args: CommandArgs): ActionFuncAsync<ExecuteCommandReturnType> {
    return async (dispatch, getState) => {
        const state = getState();

        let msg = message;

        let cmdLength = msg.indexOf(' ');
        if (cmdLength < 0) {
            cmdLength = msg.length;
        }
        const cmd = msg.substring(0, cmdLength).toLowerCase();
        msg = cmd + ' ' + msg.substring(cmdLength, msg.length).trim();

        // Add track event for certain slash commands
        const commandsWithTelemetry = [
            {command: '/help', telemetry: 'slash-command-help'},
            {command: '/marketplace', telemetry: 'slash-command-marketplace'},
        ];
        for (const command of commandsWithTelemetry) {
            if (msg.startsWith(command.command)) {
                trackEvent('slash-commands', command.telemetry);
                break;
            }
        }

        switch (cmd) {
        case '/search':
            dispatch(PostActions.searchForTerm(msg.substring(cmdLength + 1, msg.length)));
            return {data: {frontendHandled: true}};
        case '/shortcuts':
            if (UserAgent.isMobile()) {
                const error = {message: localizeMessage({id: 'create_post.shortcutsNotSupported', defaultMessage: 'Keyboard shortcuts are not supported on your device'})};
                return {error};
            }

            dispatch(openModal({modalId: ModalIdentifiers.KEYBOARD_SHORTCUTS_MODAL, dialogType: KeyboardShortcutsModal}));
            return {data: {frontendHandled: true}};
        case '/leave': {
            // /leave command not supported in reply threads.
            if (args.channel_id && args.root_id) {
                dispatch(GlobalActions.sendEphemeralPost('/leave is not supported in reply threads. Use it in the center channel instead.', args.channel_id, args.root_id));
                return {data: {frontendHandled: true}};
            }
            const channel = getCurrentChannel(state);
            if (!channel) {
                return {data: {silentFailureReason: new Error('cannot find current channel')}};
            }
            if (channel.type === Constants.PRIVATE_CHANNEL) {
                dispatch(openModal({modalId: ModalIdentifiers.LEAVE_PRIVATE_CHANNEL_MODAL, dialogType: LeaveChannelModal, dialogProps: {channel}}));
                return {data: {frontendHandled: true}};
            }
            if (
                channel.type === Constants.DM_CHANNEL ||
                channel.type === Constants.GM_CHANNEL
            ) {
                const currentUserId = getCurrentUserId(state);
                let name;
                let category;
                if (channel.type === Constants.DM_CHANNEL) {
                    name = getUserIdFromChannelName(channel);
                    category = Constants.Preferences.CATEGORY_DIRECT_CHANNEL_SHOW;
                } else {
                    name = channel.id;
                    category = Constants.Preferences.CATEGORY_GROUP_CHANNEL_SHOW;
                }
                const currentTeamId = getCurrentTeamId(state);
                const redirectChannel = getRedirectChannelNameForTeam(state, currentTeamId);
                const teamUrl = getCurrentRelativeTeamUrl(state);
                getHistory().push(`${teamUrl}/channels/${redirectChannel}`);

                dispatch(savePreferences(currentUserId, [{category, name, user_id: currentUserId, value: 'false'}]));
                if (isFavoriteChannel(state, channel.id)) {
                    dispatch(unfavoriteChannel(channel.id));
                }

                return {data: {frontendHandled: true}};
            }
            break;
        }
        case '/settings':
            dispatch(openModal({modalId: ModalIdentifiers.USER_SETTINGS, dialogType: UserSettingsModal, dialogProps: {isContentProductSettings: true}}));
            return {data: {frontendHandled: true}};
        case '/marketplace':
            // check if user has permissions to access the read plugins
            if (!haveICurrentTeamPermission(state, Permissions.SYSCONSOLE_WRITE_PLUGINS)) {
                return {error: {message: localizeMessage({id: 'marketplace_command.no_permission', defaultMessage: 'You do not have the appropriate permissions to access the marketplace.'})}};
            }

            // check config to see if marketplace is enabled
            if (!isMarketplaceEnabled(state)) {
                return {error: {message: localizeMessage({id: 'marketplace_command.disabled', defaultMessage: 'The marketplace is disabled. Please contact your System Administrator for details.'})}};
            }

            dispatch(openModal({modalId: ModalIdentifiers.PLUGIN_MARKETPLACE, dialogType: MarketplaceModal, dialogProps: {openedFrom: 'command'}}));
            return {data: {frontendHandled: true}};
        case '/collapse':
        case '/expand':
            dispatch(PostActions.resetEmbedVisibility());
            dispatch(PostActions.resetInlineImageVisibility());
        }

        if (appsEnabled(state)) {
            const getGlobalState = () => getState();
            const createErrorMessage = (errMessage: string) => {
                return {error: {message: errMessage}};
            };
            const parser = new AppCommandParser({dispatch, getState: getGlobalState} as any, intlShim, args.channel_id, args.team_id, args.root_id);
            if (parser.isAppCommand(msg)) {
                try {
                    const {creq, errorMessage} = await parser.composeCommandSubmitCall(msg);
                    if (!creq) {
                        return createErrorMessage(errorMessage!);
                    }

                    const res = await dispatch(doAppSubmit(creq, intlShim));

                    if (res.error) {
                        const errorResponse = res.error;
                        return createErrorMessage(errorResponse.text || intlShim.formatMessage({
                            id: 'apps.error.unknown',
                            defaultMessage: 'Unknown error occurred.',
                        }));
                    }

                    const callResp = res.data!;
                    switch (callResp.type) {
                    case AppCallResponseTypes.OK:
                        if (callResp.text) {
                            dispatch(postEphemeralCallResponseForCommandArgs(callResp, callResp.text, args));
                        }
                        return {data: {appResponse: callResp}};
                    case AppCallResponseTypes.FORM:
                        if (callResp.form) {
                            dispatch(openAppsModal(callResp.form, creq.context));
                        }
                        return {data: {appResponse: callResp}};
                    case AppCallResponseTypes.NAVIGATE:
                        return {data: {appResponse: callResp}};
                    default:
                        return createErrorMessage(intlShim.formatMessage(
                            {
                                id: 'apps.error.responses.unknown_type',
                                defaultMessage: 'App response type not supported. Response type: {type}.',
                            },
                            {
                                type: callResp.type,
                            },
                        ));
                    }
                } catch (err: any) {
                    const message = err.message || intlShim.formatMessage({
                        id: 'apps.error.unknown',
                        defaultMessage: 'Unknown error occurred.',
                    });
                    return createErrorMessage(message);
                }
            }
        }

        let data;
        try {
            data = await Client4.executeCommand(msg, args);
        } catch (err) {
            return {error: err};
        }

        const hasGotoLocation = data.goto_location && isUrlSafe(data.goto_location);

        if (msg.trim() === '/logout') {
            GlobalActions.emitUserLoggedOutEvent(hasGotoLocation ? data.goto_location : '/');
            return {data: {response: data}};
        }

        if (data.trigger_id) {
            dispatch({type: IntegrationTypes.RECEIVED_DIALOG_TRIGGER_ID, data: data.trigger_id});
        }

        if (hasGotoLocation) {
            if (data.goto_location.startsWith('/')) {
                getHistory().push(data.goto_location);
            } else if (data.goto_location.startsWith(getSiteURL())) {
                getHistory().push(data.goto_location.substr(getSiteURL().length));
            } else {
                window.open(data.goto_location);
            }
        }

        return {data: {response: data}};
    };
}
