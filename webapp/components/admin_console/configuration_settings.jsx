// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';
import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';

import ErrorStore from 'stores/error_store.jsx';

import {ErrorBarTypes} from 'utils/constants.jsx';
import * as Utils from 'utils/utils.jsx';

import {invalidateAllCaches, reloadConfig} from 'actions/admin_actions.jsx';
import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import {ConnectionSecurityDropdownSettingWebserver} from './connection_security_dropdown_setting.jsx';
import SettingsGroup from './settings_group.jsx';
import RequestButton from './request_button/request_button';
import TextSetting from './text_setting.jsx';
import WebserverModeDropdownSetting from './webserver_mode_dropdown_setting.jsx';

export default class ConfigurationSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);

        this.handleSaved = this.handleSaved.bind(this);

        this.renderSettings = this.renderSettings.bind(this);
    }

    componentWillReceiveProps(nextProps) {
        // special case for this page since we don't update AdminSettings components when the
        // stored config changes, but we want this page to update when you reload the config
        this.setState(this.getStateFromConfig(nextProps.config));
    }

    getConfigFromState(config) {
        config.ServiceSettings.SiteURL = this.state.siteURL;
        config.ServiceSettings.ListenAddress = this.state.listenAddress;
        config.ServiceSettings.WebserverMode = this.state.webserverMode;
        config.ServiceSettings.ConnectionSecurity = this.state.connectionSecurity;
        config.ServiceSettings.TLSCertFile = this.state.TLSCertFile;
        config.ServiceSettings.TLSKeyFile = this.state.TLSKeyFile;
        config.ServiceSettings.UseLetsEncrypt = this.state.useLetsEncrypt;
        config.ServiceSettings.LetsEncryptCertificateCacheFile = this.state.letsEncryptCertificateCacheFile;
        config.ServiceSettings.Forward80To443 = this.state.forward80To443;
        config.ServiceSettings.ReadTimeout = this.parseIntNonZero(this.state.readTimeout);
        config.ServiceSettings.WriteTimeout = this.parseIntNonZero(this.state.writeTimeout);
        config.ServiceSettings.EnableAPIv3 = this.state.enableAPIv3;

        return config;
    }

    getStateFromConfig(config) {
        return {
            siteURL: config.ServiceSettings.SiteURL,
            listenAddress: config.ServiceSettings.ListenAddress,
            webserverMode: config.ServiceSettings.WebserverMode,
            connectionSecurity: config.ServiceSettings.ConnectionSecurity,
            TLSCertFile: config.ServiceSettings.TLSCertFile,
            TLSKeyFile: config.ServiceSettings.TLSKeyFile,
            useLetsEncrypt: config.ServiceSettings.UseLetsEncrypt,
            letsEncryptCertificateCacheFile: config.ServiceSettings.LetsEncryptCertificateCacheFile,
            forward80To443: config.ServiceSettings.Forward80To443,
            readTimeout: config.ServiceSettings.ReadTimeout,
            writeTimeout: config.ServiceSettings.WriteTimeout,
            enableAPIv3: config.ServiceSettings.EnableAPIv3
        };
    }

    handleSaved(newConfig) {
        if (newConfig.ServiceSettings.SiteURL) {
            ErrorStore.clearError(ErrorBarTypes.SITE_URL);
        }
    }

    renderTitle() {
        return (
            <FormattedMessage
                id='admin.general.configuration'
                defaultMessage='Configuration'
            />
        );
    }

    renderSettings() {
        const reloadConfigurationHelpText = (
            <FormattedMessage
                id='admin.reload.reloadDescription'
                defaultMessage='Deployments using multiple databases can switch from one master database to another without restarting the Mattermost server by updating "config.json" to the new desired configuration and using the {featureName} feature to load the new settings while the server is running. The administrator should then use the {recycleDatabaseConnections} feature to recycle the database connections based on the new settings.'
                values={{
                    featureName: (
                        <b>
                            <FormattedMessage
                                id='admin.reload.reloadDescription.featureName'
                                defaultMessage='Reload Configuration from Disk'
                            />
                        </b>
                    ),
                    recycleDatabaseConnections: (
                        <a href='../advanced/database'>
                            <b>
                                <FormattedMessage
                                    id='admin.reload.reloadDescription.recycleDatabaseConnections'
                                    defaultMessage='Database > Recycle Database Connections'
                                />
                            </b>
                        </a>
                    )
                }}
            />
        );

        let reloadConfigButton = <div/>;
        if (global.window.mm_license.IsLicensed === 'true') {
            reloadConfigButton = (
                <RequestButton
                    requestAction={reloadConfig}
                    helpText={reloadConfigurationHelpText}
                    buttonText={
                        <FormattedMessage
                            id='admin.reload.button'
                            defaultMessage='Reload Configuration From Disk'
                        />
                    }
                    showSuccessMessage={false}
                    errorMessage={{
                        id: 'admin.reload.reloadFail',
                        defaultMessage: 'Reload unsuccessful: {error}'
                    }}
                />
            );
        }

        return (
            <SettingsGroup>
                <div className='banner'>
                    <div className='banner__content'>
                        <FormattedMessage
                            id='admin.rate.noteDescription'
                            defaultMessage='Changing properties other than Site URL in this section will require a server restart before taking effect.'
                        />
                    </div>
                </div>
                <TextSetting
                    id='siteURL'
                    label={
                        <FormattedMessage
                            id='admin.service.siteURL'
                            defaultMessage='Site URL:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.siteURLExample', 'Ex "https://mattermost.example.com:1234"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.siteURLDescription'
                            defaultMessage='The URL that users will use to access Mattermost. Standard ports, such as 80 and 443, can be omitted, but non-standard ports are required. For example: http://mattermost.example.com:8065. This setting is required.'
                        />
                    }
                    value={this.state.siteURL}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='listenAddress'
                    label={
                        <FormattedMessage
                            id='admin.service.listenAddress'
                            defaultMessage='Listen Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.service.listenExample', 'Ex ":8065"')}
                    helpText={
                        <FormattedMessage
                            id='admin.service.listenDescription'
                            defaultMessage='The address and port to which to bind and listen. Specifying ":8065" will bind to all network interfaces. Specifying "127.0.0.1:8065" will only bind to the network interface having that IP address. If you choose a port of a lower level (called "system ports" or "well-known ports", in the range of 0-1023), you must have permissions to bind to that port. On Linux you can use: "sudo setcap cap_net_bind_service=+ep ./bin/platform" to allow Mattermost to bind to well-known ports.'
                        />
                    }
                    value={this.state.listenAddress}
                    onChange={this.handleChange}
                />
                <ConnectionSecurityDropdownSettingWebserver
                    value={this.state.connectionSecurity}
                    onChange={this.handleChange}
                    disabled={false}
                />
                <TextSetting
                    id='TLSCertFile'
                    label={
                        <FormattedMessage
                            id='admin.service.tlsCertFile'
                            defaultMessage='TLS Certificate File:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.tlsCertFileDescription'
                            defaultMessage='The certificate file to use.'
                        />
                    }
                    disabled={this.state.useLetsEncrypt}
                    value={this.state.TLSCertFile}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='TLSKeyFile'
                    label={
                        <FormattedMessage
                            id='admin.service.tlsKeyFile'
                            defaultMessage='TLS Key File:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.tlsKeyFileDescription'
                            defaultMessage='The private key file to use.'
                        />
                    }
                    disabled={this.state.useLetsEncrypt}
                    value={this.state.TLSKeyFile}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='useLetsEncrypt'
                    label={
                        <FormattedMessage
                            id='admin.service.useLetsEncrypt'
                            defaultMessage="Use Let's Encrypt:"
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.useLetsEncryptDescription'
                            defaultMessage="Enable the automatic retreval of certificates from the Let's Encrypt. The certificate will be retrieved when a client attempts to connect from a new domain. This will work with multiple domains."
                        />
                    }
                    value={this.state.useLetsEncrypt}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='letsEncryptCertificateCacheFile'
                    label={
                        <FormattedMessage
                            id='admin.service.letsEncryptCertificateCacheFile'
                            defaultMessage="Let's Encrypt Certificate Cache File:"
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.letsEncryptCertificateCacheFileDescription'
                            defaultMessage="Certificates retrieved and other data about the Let's Encrypt service will be stored in this file."
                        />
                    }
                    disabled={!this.state.useLetsEncrypt}
                    value={this.state.letsEncryptCertificateCacheFile}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='forward80To443'
                    label={
                        <FormattedMessage
                            id='admin.service.forward80To443'
                            defaultMessage='Forward port 80 to 443:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.forward80To443Description'
                            defaultMessage='Forwards all insecure traffic from port 80 to secure port 443'
                        />
                    }
                    value={this.state.forward80To443}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='readTimeout'
                    label={
                        <FormattedMessage
                            id='admin.service.readTimeout'
                            defaultMessage='Read Timeout:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.readTimeoutDescription'
                            defaultMessage='Maximum time allowed from when the connection is accepted to when the request body is fully read.'
                        />
                    }
                    value={this.state.readTimeout}
                    onChange={this.handleChange}
                />
                <TextSetting
                    id='writeTimeout'
                    label={
                        <FormattedMessage
                            id='admin.service.writeTimeout'
                            defaultMessage='Write Timeout:'
                        />
                    }
                    helpText={
                        <FormattedMessage
                            id='admin.service.writeTimeoutDescription'
                            defaultMessage='If using HTTP (insecure), this is the maximum time allowed from the end of reading the request headers until the response is written. If using HTTPS, it is the total time from when the connection is accepted until the response is written.'
                        />
                    }
                    value={this.state.writeTimeout}
                    onChange={this.handleChange}
                />
                <BooleanSetting
                    id='enableAPIv3'
                    label={
                        <FormattedMessage
                            id='admin.service.enableAPIv3'
                            defaultMessage='Allow use of API v3 endpoints:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.service.enableAPIv3Description'
                            defaultMessage='Set to false to disable all version 3 endpoints of the REST API. Integrations that rely on API v3 will fail and can then be identified for migration to API v4. API v3 is deprecated and will be removed in the near future. See <a href="https://api.mattermost.com" target="_blank">https://api.mattermost.com</a> for details.'
                        />
                    }
                    value={this.state.enableAPIv3}
                    onChange={this.handleChange}
                />
                <WebserverModeDropdownSetting
                    value={this.state.webserverMode}
                    onChange={this.handleChange}
                    disabled={false}
                />
                {reloadConfigButton}
                <RequestButton
                    requestAction={invalidateAllCaches}
                    helpText={
                        <FormattedMessage
                            id='admin.purge.purgeDescription'
                            defaultMessage='This will purge all the in-memory caches for things like sessions, accounts, channels, etc. Deployments using High Availability will attempt to purge all the servers in the cluster.  Purging the caches may adversely impact performance.'
                        />
                    }
                    buttonText={
                        <FormattedMessage
                            id='admin.purge.button'
                            defaultMessage='Purge All Caches'
                        />
                    }
                    showSuccessMessage={false}
                    includeDetailedError={true}
                    errorMessage={{
                        id: 'admin.purge.purgeFail',
                        defaultMessage: 'Purging unsuccessful: {error}'
                    }}
                />
            </SettingsGroup>
        );
    }
}
