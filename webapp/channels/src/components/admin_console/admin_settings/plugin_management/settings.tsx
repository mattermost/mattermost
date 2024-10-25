// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage} from 'react-intl';

import BooleanSetting from 'components/admin_console/boolean_setting';
import ExternalLink from 'components/external_link';

import {DeveloperLinks} from 'utils/constants';

import {FIELD_IDS} from './constants';
import {messages} from './messages';

import {useIsSetByEnv} from '../hooks';
import type {MinimalBooleanSettingProps} from '../types';

export function makePluginLink(href: string) {
    return (msg: React.ReactNode) => (
        <ExternalLink
            href={href}
            location='plugin_management'
        >
            {msg}
        </ExternalLink>
    );
}

export const AutomaticPrepackagedPlugins = (props: MinimalBooleanSettingProps) => {
    const setByEnv = useIsSetByEnv('PluginSettings.AutomaticPrepackagedPlugins');
    return (
        <BooleanSetting
            id={FIELD_IDS.AUTOMATIC_PREPACKAGED_PLUGINS}
            label={<FormattedMessage {...messages.automaticPrepackagedPlugins}/>}
            helpText={<FormattedMessage {...messages.automaticPrepackagedPluginsDesc}/>}
            setByEnv={setByEnv}
            {...props}
        />
    );
};

export const EnableMarketplace = (props: MinimalBooleanSettingProps) => {
    const setByEnv = useIsSetByEnv('PluginSettings.EnableMarketplace');
    return (
        <BooleanSetting
            id={FIELD_IDS.ENABLE_MARKETPLACE}
            label={<FormattedMessage {...messages.enableMarketplace}/>}
            helpText={
                <FormattedMessage
                    {...messages.enableMarketplaceDesc}
                    values={{
                        link: makePluginLink('https://mattermost.com/pl/default-mattermost-marketplace.html'),
                    }}
                />
            }
            setByEnv={setByEnv}
            {...props}
        />
    );
};

export const EnablePluginsSetting = (props: MinimalBooleanSettingProps) => {
    const setByEnv = useIsSetByEnv('PluginSettings.Enable');
    return (
        <BooleanSetting
            id={FIELD_IDS.ENABLE}
            label={<FormattedMessage {...messages.enable}/>}
            helpText={
                <FormattedMessage
                    {...messages.enableDesc}
                    values={{
                        link: makePluginLink('plugin_management'),
                    }}
                />
            }
            setByEnv={setByEnv}
            {...props}
        />
    );
};

export const EnableRemoteMarketplace = (props: MinimalBooleanSettingProps) => {
    const setByEnv = useIsSetByEnv('PluginSettings.EnableRemoteMarketplace');
    return (
        <BooleanSetting
            id={FIELD_IDS.ENABLE_REMOTE_MARKETPLACE}
            label={<FormattedMessage {...messages.enableRemoteMarketplace}/>}
            helpText={<FormattedMessage {...messages.enableRemoteMarketplaceDesc}/>}
            setByEnv={setByEnv}
            {...props}
        />
    );
};

export const RequirePluginSignature = (props: MinimalBooleanSettingProps) => {
    const setByEnv = useIsSetByEnv('PluginSettings.RequirePluginSignature');
    return (
        <BooleanSetting
            id={FIELD_IDS.REQUIRE_PLUGIN_SIGNATURE}
            label={
                <FormattedMessage
                    id='admin.plugins.settings.requirePluginSignature'
                    defaultMessage='Require Plugin Signature:'
                />
            }
            helpText={
                <FormattedMessage
                    id='admin.plugins.settings.requirePluginSignatureDesc'
                    defaultMessage='When true, uploading plugins is disabled and may only be installed through the Marketplace. Plugins are always verified during Mattermost server startup and initialization. See <link>documentation</link> to learn more.'
                    values={{
                        link: makePluginLink(DeveloperLinks.PLUGIN_SIGNING),
                    }}
                />
            }
            setByEnv={setByEnv}
            {...props}
        />
    );
};
