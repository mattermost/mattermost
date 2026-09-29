// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {type JSX} from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {OpenInNewIcon, PowerPlugOutlineIcon} from '@mattermost/compass-icons/components';
import type {PropertyFieldOwner} from '@mattermost/types/properties_user';

import {getPluginDisplayName} from 'selectors/plugins';

import {useInstalledPluginIds} from 'components/common/hooks/use_field_orphaned';

import type {GlobalState} from 'types/store';

import './attribute_plugin_source.scss';

import {useOwnersLabel} from '../use_owners_label';

type Props = {
    owners: PropertyFieldOwner[];

    // Installed-plugin detection reads as "nothing installed" until the fetch settles.
    pluginInventoryLoaded: boolean;
};

function OwnerSettingsLink({pluginId}: {pluginId: string}): JSX.Element {
    const pluginName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));

    return (
        <Link
            to={`/admin_console/plugins/plugin_${pluginId}`}
            className='AttributePluginSource__link'
            data-testid={`attributeOwnersSourceLink-${pluginId}`}
        >
            <FormattedMessage
                {...messages.settingsLink}
                values={{pluginName}}
            />
            <OpenInNewIcon
                size={14}
                aria-hidden={true}
            />
        </Link>
    );
}

function AttributeOwnersSource({owners, pluginInventoryLoaded}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const ownersLabel = useOwnersLabel(owners);
    const scopedOwnersLabel = useOwnersLabel(owners, {withScopes: true});
    const installedPluginIds = useInstalledPluginIds();

    return (
        <div
            className='AttributePluginSource'
            data-testid='attributeOwnersSource'
        >
            <div className='AttributePluginSource__managedBy'>
                <PowerPlugOutlineIcon
                    size={16}
                    aria-hidden={true}
                />
                <span data-testid='attributeOwnersSourceManagedBy'>
                    {formatMessage(messages.managedBy, {owners: scopedOwnersLabel})}
                </span>
                {pluginInventoryLoaded && owners.map((owner) => (
                    owner.type === 'plugin' && installedPluginIds.has(owner.id) && (
                        <OwnerSettingsLink
                            key={owner.id}
                            pluginId={owner.id}
                        />
                    )
                ))}
            </div>
            <p
                className='AttributePluginSource__helperText'
                data-testid='attributeOwnersSourceHelperText'
            >
                {formatMessage(messages.helperText, {owners: ownersLabel})}
            </p>
        </div>
    );
}

export default AttributeOwnersSource;

const messages = defineMessages({
    managedBy: {
        id: 'admin.global_attributes.attribute_details.owners_source.managed_by',
        defaultMessage: 'Managed by {owners}',
    },
    settingsLink: {
        id: 'admin.global_attributes.attribute_details.owners_source.settings_link',
        defaultMessage: '{pluginName} settings',
    },
    helperText: {
        id: 'admin.global_attributes.attribute_details.owners_source.helper_text',
        defaultMessage: 'Values for users are set by {owners}. Unique name and type are locked; display name, options, and Profile display can still be changed here.',
    },
});
