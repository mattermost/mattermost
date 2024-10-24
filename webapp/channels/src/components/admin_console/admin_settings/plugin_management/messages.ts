// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const messages = defineMessages({
    title: {id: 'admin.plugin.management.title', defaultMessage: 'Management'},
    enable: {id: 'admin.plugins.settings.enable', defaultMessage: 'Enable Plugins: '},
    enableDesc: {id: 'admin.plugins.settings.enableDesc', defaultMessage: 'When true, enables plugins on your Mattermost server. Use plugins to integrate with third-party systems, extend functionality, or customize the user interface of your Mattermost server. See <link>documentation</link> to learn more.'},
    uploadTitle: {id: 'admin.plugin.uploadTitle', defaultMessage: 'Upload Plugin: '},
    installedTitle: {id: 'admin.plugin.installedTitle', defaultMessage: 'Installed Plugins: '},
    installedDesc: {id: 'admin.plugin.installedDesc', defaultMessage: 'Installed plugins on your Mattermost server.'},
    uploadDesc: {id: 'admin.plugin.uploadDesc', defaultMessage: 'Upload a plugin for your Mattermost server. See <link>documentation</link> to learn more.'},
    uploadDisabledDesc: {id: 'admin.plugin.uploadDisabledDesc', defaultMessage: 'Enable plugin uploads in config.json. See <link>documentation</link> to learn more.'},
    enableMarketplace: {id: 'admin.plugins.settings.enableMarketplace', defaultMessage: 'Enable Marketplace:'},
    enableMarketplaceDesc: {id: 'admin.plugins.settings.enableMarketplaceDesc', defaultMessage: 'When true, enables System Administrators to install plugins from the <link>marketplace</link>.'},
    enableRemoteMarketplace: {id: 'admin.plugins.settings.enableRemoteMarketplace', defaultMessage: 'Enable Remote Marketplace:'},
    enableRemoteMarketplaceDesc: {id: 'admin.plugins.settings.enableRemoteMarketplaceDesc', defaultMessage: 'When true, marketplace fetches latest plugins from the configured Marketplace URL.'},
    automaticPrepackagedPlugins: {id: 'admin.plugins.settings.automaticPrepackagedPlugins', defaultMessage: 'Enable Automatic Prepackaged Plugins:'},
    automaticPrepackagedPluginsDesc: {id: 'admin.plugins.settings.automaticPrepackagedPluginsDesc', defaultMessage: 'When true, automatically installs any prepackaged plugin found to be enabled in the server configuration.'},
    marketplaceUrl: {id: 'admin.plugins.settings.marketplaceUrl', defaultMessage: 'Marketplace URL:'},
    marketplaceUrlDesc: {id: 'admin.plugins.settings.marketplaceUrlDesc', defaultMessage: 'URL of the marketplace server.'},
});

export const searchableStrings = [
    messages.title,
    messages.enable,
    messages.enableDesc,
    messages.uploadTitle,
    messages.installedTitle,
    messages.installedDesc,
    messages.uploadDesc,
    messages.uploadDisabledDesc,
    messages.enableMarketplace,
    messages.enableMarketplaceDesc,
    messages.enableRemoteMarketplace,
    messages.enableRemoteMarketplaceDesc,
    messages.automaticPrepackagedPlugins,
    messages.automaticPrepackagedPluginsDesc,
    messages.marketplaceUrl,
    messages.marketplaceUrlDesc,
];
