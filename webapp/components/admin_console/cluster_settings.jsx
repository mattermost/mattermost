// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

import React from 'react';

import AdminSettings from './admin_settings.jsx';
import BooleanSetting from './boolean_setting.jsx';
import TextSetting from './text_setting.jsx';

import {FormattedMessage, FormattedHTMLMessage} from 'react-intl';
import SettingsGroup from './settings_group.jsx';
import ClusterTableContainer from './cluster_table_container.jsx';

import AdminStore from 'stores/admin_store.jsx';
import * as Utils from 'utils/utils.jsx';

export default class ClusterSettings extends AdminSettings {
    constructor(props) {
        super(props);

        this.getConfigFromState = this.getConfigFromState.bind(this);
        this.renderSettings = this.renderSettings.bind(this);
    }

    getConfigFromState(config) {
        config.ClusterSettings.Enable = this.state.enable;
        config.ClusterSettings.InterNodeListenAddress = this.state.interNodeListenAddress;

        config.ClusterSettings.InterNodeUrls = this.state.interNodeUrls.split(',');
        config.ClusterSettings.InterNodeUrls = config.ClusterSettings.InterNodeUrls.map((url) => {
            return url.trim();
        });

        if (config.ClusterSettings.InterNodeUrls.length === 1 && config.ClusterSettings.InterNodeUrls[0] === '') {
            config.ClusterSettings.InterNodeUrls = [];
        }

        return config;
    }

    getStateFromConfig(config) {
        const settings = config.ClusterSettings;

        return {
            enable: settings.Enable,
            interNodeUrls: settings.InterNodeUrls.join(', '),
            interNodeListenAddress: settings.InterNodeListenAddress,
            showWarning: false
        };
    }

    renderTitle() {
        return (
            <h3>
                <FormattedMessage
                    id='admin.advance.cluster'
                    defaultMessage='High Availability (Beta)'
                />
            </h3>
        );
    }

    overrideHandleChange = (id, value) => {
        this.setState({
            showWarning: true
        });

        this.handleChange(id, value);
    }

    renderSettings() {
        const licenseEnabled = global.window.mm_license.IsLicensed === 'true' && global.window.mm_license.Cluster === 'true';
        if (!licenseEnabled) {
            return null;
        }

        var configLoadedFromCluster = null;

        if (AdminStore.getClusterId()) {
            configLoadedFromCluster = (
                <div
                    style={{marginBottom: '10px'}}
                    className='alert alert-warning'
                >
                    <i className='fa fa-warning'></i>
                    <FormattedHTMLMessage
                        id='admin.cluster.loadedFrom'
                        defaultMessage='This configuration file was loaded from Node ID {clusterId}. Please see the Troubleshooting Guide in our <a href="http://docs.mattermost.com/deployment/cluster.html" target="_blank">documentation</a> if you are accessing the System Console through a load balancer and experiencing issues.'
                        values={{
                            clusterId: AdminStore.getClusterId()
                        }}
                    />
                </div>
            );
        }

        var warning = null;
        if (this.state.showWarning) {
            warning = (
                <div
                    style={{marginBottom: '10px'}}
                    className='alert alert-warning'
                >
                    <i className='fa fa-warning'></i>
                    <FormattedMessage
                        id='admin.cluster.should_not_change'
                        defaultMessage='WARNING: These settings may not sync with the other servers in the cluster. High Availability inter-node communication will not start until you modify the config.json to be identical on all servers and restart Mattermost. Please see the <a href="http://docs.mattermost.com/deployment/cluster.html" target="_blank">documentation</a> on how to add or remove a server from the cluster. If you are accessing the System Console through a load balancer and experiencing issues, please see the Troubleshooting Guide in our <a href="http://docs.mattermost.com/deployment/cluster.html" target="_blank">documentation</a>.'
                    />
                </div>
            );
        }

        var clusterTableContainer = null;
        if (this.state.enable) {
            clusterTableContainer = (<ClusterTableContainer/>);
        }

        return (
            <SettingsGroup>
                {configLoadedFromCluster}
                {clusterTableContainer}
                <p>
                    <FormattedMessage
                        id='admin.cluster.noteDescription'
                        defaultMessage='Changing properties in this section will require a server restart before taking effect. When High Availability mode is enabled, the System Console is set to read-only and can only be changed from the configuration file.'
                    />
                </p>
                {warning}
                <BooleanSetting
                    id='enable'
                    label={
                        <FormattedMessage
                            id='admin.cluster.enableTitle'
                            defaultMessage='Enable High Availability Mode:'
                        />
                    }
                    helpText={
                        <FormattedHTMLMessage
                            id='admin.cluster.enableDescription'
                            defaultMessage='When true, Mattermost will run in High Availability mode. Please see <a href="http://docs.mattermost.com/deployment/cluster.html" target="_blank">documentation</a> to learn more about configuring High Availability for Mattermost.'
                        />
                    }
                    value={this.state.enable}
                    onChange={this.overrideHandleChange}
                    disabled={true}
                />
                <TextSetting
                    id='interNodeListenAddress'
                    label={
                        <FormattedMessage
                            id='admin.cluster.interNodeListenAddressTitle'
                            defaultMessage='Inter-Node Listen Address:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.cluster.interNodeListenAddressEx', 'Ex ":8075"')}
                    helpText={
                        <FormattedMessage
                            id='admin.cluster.interNodeListenAddressDesc'
                            defaultMessage='The address the server will listen on for communicating with other servers.'
                        />
                    }
                    value={this.state.interNodeListenAddress}
                    onChange={this.overrideHandleChange}
                    disabled={true}
                />
                <TextSetting
                    id='interNodeUrls'
                    label={
                        <FormattedMessage
                            id='admin.cluster.interNodeUrlsTitle'
                            defaultMessage='Inter-Node URLs:'
                        />
                    }
                    placeholder={Utils.localizeMessage('admin.cluster.interNodeUrlsEx', 'Ex "http://10.10.10.30, http://10.10.10.31"')}
                    helpText={
                        <FormattedMessage
                            id='admin.cluster.interNodeUrlsDesc'
                            defaultMessage='The internal/private URLs of all the Mattermost servers separated by commas.'
                        />
                    }
                    value={this.state.interNodeUrls}
                    onChange={this.overrideHandleChange}
                    disabled={true}
                />
            </SettingsGroup>
        );
    }
}