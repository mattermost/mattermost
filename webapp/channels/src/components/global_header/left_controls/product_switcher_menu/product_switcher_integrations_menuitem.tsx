// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';
import {useHistory} from 'react-router-dom';

import {WebhookIncomingIcon} from '@mattermost/compass-icons/components';
import type {ProductIdentifier} from '@mattermost/types/products';

import {Permissions} from 'mattermost-redux/constants';
import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {haveICurrentTeamPermission, haveISystemPermission} from 'mattermost-redux/selectors/entities/roles';
import {getCurrentTeam} from 'mattermost-redux/selectors/entities/teams';

import * as Menu from 'components/menu';

import {isChannels} from 'utils/products';

import type {GlobalState} from 'types/store';

interface Props {
    currentProductID: ProductIdentifier;
}

export default function ProductSwitcherIntegrationsMenuItem(props: Props) {
    const history = useHistory();

    const currentTeam = useSelector(getCurrentTeam);

    const config = useSelector(getConfig);
    const haveEnabledIncomingWebhooks = config.EnableIncomingWebhooks === 'true';
    const haveEnabledOutgoingWebhooks = config.EnableOutgoingWebhooks === 'true';
    const haveEnabledSlashCommands = config.EnableCommands === 'true';
    const haveEnabledOAuthServiceProvider = config.EnableOAuthServiceProvider === 'true';

    const havePermissionToManageSlashCommands = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_SLASH_COMMANDS));
    const havePermissionToManageOAuth = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_OAUTH));
    const havePermissionToManageIncomingWebhooks = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_INCOMING_WEBHOOKS));
    const havePermissionToManageOutgoingWebhooks = useSelector((state: GlobalState) => haveICurrentTeamPermission(state, Permissions.MANAGE_OUTGOING_WEBHOOKS));
    const havePermissionsToManageTeamIntegration = havePermissionToManageSlashCommands || havePermissionToManageOAuth || havePermissionToManageIncomingWebhooks || havePermissionToManageOutgoingWebhooks;

    const havePermissionToManageBots = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.MANAGE_BOTS}));
    const havePermissionToManageOthersBots = useSelector((state: GlobalState) => haveISystemPermission(state, {permission: Permissions.MANAGE_OTHERS_BOTS}));
    const havePermissionToManageSystemBots = havePermissionToManageBots || havePermissionToManageOthersBots;

    const areIntegrationsEnabled = haveEnabledIncomingWebhooks || haveEnabledOutgoingWebhooks || haveEnabledSlashCommands || haveEnabledOAuthServiceProvider || havePermissionsToManageTeamIntegration || havePermissionToManageSystemBots;

    const isChannelsProductActive = isChannels(props.currentProductID);

    if (!isChannelsProductActive) {
        return null;
    }

    if (!areIntegrationsEnabled) {
        return null;
    }

    function handleClick() {
        if (!currentTeam) {
            return;
        }

        history.push(`/${currentTeam.name}/integrations`);
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
