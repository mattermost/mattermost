// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {defineMessages, FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';
import {Link} from 'react-router-dom';

import {OpenInNewIcon, PowerPlugOutlineIcon} from '@mattermost/compass-icons/components';

import {getPluginDisplayName} from 'selectors/plugins';

import type {GlobalState} from 'types/store';

import './attribute_plugin_source.scss';

type Props = {
    pluginId: string;
    isOrphaned: boolean;
};

// Renders in the exact slot AttributeExternalSource occupies at the bottom of
// the Definition card, for a plugin-owned field only (see attribute_details.tsx).
// Purely presentational -- no data-mutating dispatch, no Client4 calls, and no
// `disabled` prop, since it has no interactive control to disable when not
// orphaned (the settings link is always navigable) and renders no link at all
// when orphaned.
function AttributePluginSource({pluginId, isOrphaned}: Props): JSX.Element {
    const {formatMessage} = useIntl();
    const pluginDisplayName = useSelector((state: GlobalState) => getPluginDisplayName(state, pluginId));

    return (
        <div
            className='AttributePluginSource'
            data-testid='attributePluginSource'
        >
            <div className='AttributePluginSource__managedBy'>
                <PowerPlugOutlineIcon
                    size={16}
                    aria-hidden={true}
                />
                <span data-testid='attributePluginSourceManagedBy'>
                    {isOrphaned ? (
                        <FormattedMessage
                            {...messages.managedByOrphaned}
                            values={{pluginName: pluginDisplayName}}
                        />
                    ) : (
                        <FormattedMessage
                            {...messages.managedBy}
                            values={{pluginName: pluginDisplayName}}
                        />
                    )}
                </span>
                {!isOrphaned && (
                    <Link
                        to={`/admin_console/plugins/plugin_${pluginId}`}
                        className='AttributePluginSource__link'
                        data-testid='attributePluginSourceLink'
                    >
                        <FormattedMessage {...messages.pluginSettingsLink}/>
                        <OpenInNewIcon
                            size={14}
                            aria-hidden={true}
                        />
                    </Link>
                )}
            </div>
            <p
                className='AttributePluginSource__helperText'
                data-testid='attributePluginSourceHelperText'
            >
                {formatMessage(messages.helperText)}
            </p>
        </div>
    );
}

export default AttributePluginSource;

const messages = defineMessages({
    managedBy: {
        id: 'admin.global_attributes.attribute_details.plugin_source.managed_by',
        defaultMessage: 'Managed by {pluginName}',
    },
    managedByOrphaned: {
        id: 'admin.global_attributes.attribute_details.plugin_source.managed_by_orphaned',
        defaultMessage: 'Managed by {pluginName} (no longer installed)',
    },
    pluginSettingsLink: {
        id: 'admin.global_attributes.attribute_details.plugin_source.settings_link',
        defaultMessage: 'Plugin settings',
    },
    helperText: {
        id: 'admin.global_attributes.attribute_details.plugin_source.helper_text',
        defaultMessage: 'Name, type, and values are owned by the plugin and are read-only here.',
    },
});
