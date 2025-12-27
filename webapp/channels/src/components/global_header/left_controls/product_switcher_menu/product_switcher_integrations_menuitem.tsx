// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {WebhookIncomingIcon} from '@mattermost/compass-icons/components';

import {Permissions} from 'mattermost-redux/constants';
import {haveICurrentTeamPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';

import * as Menu from 'components/menu';

import type {GlobalState} from 'types/store';

interface Props {
    isChannelsProductActive: boolean;
    haveEnabledIncomingWebhooks: boolean;
    haveEnabledOutgoingWebhooks: boolean;
    haveEnabledSlashCommands: boolean;
    haveEnabledOAuthServiceProvider: boolean;
    currentTeamName?: string;
}

export default function ProductSwitcherIntegrationsMenuItem(props: Props) {
    const history = useHistory();

    // There is no global switch to turn on/off bots management, they are part of the application itself.
    // We check if user have permission to manage bots instead.
    const havePermissionToManageBots = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS}));
    const havePermissionToManageOthersBots = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.MANAGE_OTHERS_BOTS}));
    const havePermissionToManageSomeBots = havePermissionToManageBots || havePermissionToManageOthersBots;

    // We check some integrations are enabled because the integrations page lists all integrations, including those that are not enabled.
    // further per integration permission check will be done in the integrations page.
    const areSomeIntegrationsEnabled = props.haveEnabledIncomingWebhooks || props.haveEnabledOutgoingWebhooks || props.haveEnabledSlashCommands || props.haveEnabledOAuthServiceProvider || havePermissionToManageSomeBots;

    // Next we check if user have permission to manage other's or own integrations one by one.

    // 1. Incoming Webhooks
    const havePermissionToManageIncomingWebhooks = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_INCOMING_WEBHOOKS));
    const havePermissionToManageOwnIncomingWebhooks = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_OWN_INCOMING_WEBHOOKS));

    // 2. Outgoing Webhooks
    const havePermissionToManageOutgoingWebhooks = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_OUTGOING_WEBHOOKS));
    const havePermissionToManageOwnOutgoingWebhooks = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_OWN_OUTGOING_WEBHOOKS));

    // 3. Slash Commands
    const havePermissionToManageSlashCommands = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_SLASH_COMMANDS));
    const havePermissionToManageOwnSlashCommands = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_OWN_SLASH_COMMANDS));

    // 4. OAuth
    const havePermissionToManageOAuth = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.MANAGE_OAUTH}));

    // 5. Bots
    // We already checked if user have permission to manage bots or others bots above.

    const canManageSomeIntegrations = havePermissionToManageIncomingWebhooks || havePermissionToManageOwnIncomingWebhooks || havePermissionToManageOutgoingWebhooks || havePermissionToManageOwnOutgoingWebhooks || havePermissionToManageSlashCommands || havePermissionToManageOwnSlashCommands || havePermissionToManageOAuth || havePermissionToManageSomeBots;

    const canVisitIntegrationsPage = areSomeIntegrationsEnabled && canManageSomeIntegrations;

    if (!props.isChannelsProductActive) {
        return null;
    }

    if (!canVisitIntegrationsPage) {
        return null;
    }

    function handleClick() {
        if (!props.currentTeamName) {
            return;
        }

        history.push(`/${props.currentTeamName}/integrations`);
    }

    return (
        <Menu.Item
            leadingElement={<WebhookIncomingIcon size={18}/>}
            labels={
                <FormattedMessage
                    id='productSwitcherMenu.integrations.label'
                    defaultMessage='Integrations'
                />
            }
            onClick={handleClick}
        />
    );
}
