// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, defineMessage, defineMessages} from 'react-intl';

import type {AdminConfig, ClientLicense} from '@mattermost/types/config';

import {Client4} from 'mattermost-redux/client';

import ExternalLink from 'components/external_link';
import WarningIcon from 'components/widgets/icons/fa_warning_icon';

import {DocLinks} from 'utils/constants';

import BooleanSetting from './boolean_setting';
import ClusterTableContainer from './cluster_table_container';
import type {BaseProps, BaseState} from './old_admin_settings';
import OLDAdminSettings from './old_admin_settings';
import SettingsGroup from './settings_group';
import TextSetting from './text_setting';

type Props = {
    license: ClientLicense;
} & BaseProps;

type State = {
    Enable: boolean;
    ClusterName: string;
    OverrideHostname: string;
    UseIPAddress: boolean;
    EnableExperimentalGossipEncryption: boolean;
    EnableGossipCompression: boolean;
    GossipPort: number;
    showWarning: boolean;
} & BaseState;

const messages = defineMessages({
    cluster: {id: 'admin.advance.cluster', defaultMessage: 'High Availability'},
    noteDescription: {id: 'admin.cluster.noteDescription', defaultMessage: 'Changing properties in this section will require a server restart before taking effect.'},
    enableTitle: {id: 'admin.cluster.enableTitle', defaultMessage: 'Enable High Availability Mode:'},
    enableDescription: {id: 'admin.cluster.enableDescription', defaultMessage: 'When true, Mattermost will run in High Availability mode. Please see <link>documentation</link> to learn more about configuring High Availability for Mattermost.'},
    clusterName: {id: 'admin.cluster.ClusterName', defaultMessage: 'Cluster Name:'},
    clusterNameDesc: {id: 'admin.cluster.ClusterNameDesc', defaultMessage: 'The cluster to join by name. Only nodes with the same cluster name will join together. This is to support Blue-Green deployments or staging pointing to the same database.'},
    overrideHostname: {id: 'admin.cluster.OverrideHostname', defaultMessage: 'Override Hostname:'},
    overrideHostnameDesc: {id: 'admin.cluster.OverrideHostnameDesc', defaultMessage: "The default value of '<blank>' will attempt to get the Hostname from the OS or use the IP Address. You can override the hostname of this server with this property. It is not recommended to override the Hostname unless needed. This property can also be set to a specific IP Address if needed."},
    useIPAddress: {id: 'admin.cluster.UseIPAddress', defaultMessage: 'Use IP Address:'},
    useIPAddressDesc: {id: 'admin.cluster.UseIPAddressDesc', defaultMessage: 'When true, the cluster will attempt to communicate via IP Address vs using the hostname.'},
    enableExperimentalGossipEncryption: {id: 'admin.cluster.EnableExperimentalGossipEncryption', defaultMessage: 'Enable Experimental Gossip encryption:'},
    enableExperimentalGossipEncryptionDesc: {id: 'admin.cluster.EnableExperimentalGossipEncryptionDesc', defaultMessage: 'When true, all communication through the gossip protocol will be encrypted.'},
    enableGossipCompression: {id: 'admin.cluster.EnableGossipCompression', defaultMessage: 'Enable Gossip compression:'},
    enableGossipCompressionDesc: {id: 'admin.cluster.EnableGossipCompressionDesc', defaultMessage: 'When true, all communication through the gossip protocol will be compressed. It is recommended to keep this flag disabled.'},
    gossipPort: {id: 'admin.cluster.GossipPort', defaultMessage: 'Gossip Port:'},
    gossipPortDesc: {id: 'admin.cluster.GossipPortDesc', defaultMessage: 'The port used for the gossip protocol. Both UDP and TCP should be allowed on this port.'},
});

export const searchableStrings = [
    messages.cluster,
    messages.noteDescription,
    messages.enableTitle,
    messages.enableDescription,
    messages.clusterName,
    messages.clusterNameDesc,
    messages.overrideHostname,
    messages.overrideHostnameDesc,
    messages.useIPAddress,
    messages.useIPAddressDesc,
    messages.enableExperimentalGossipEncryption,
    messages.enableExperimentalGossipEncryptionDesc,
    messages.enableGossipCompression,
    messages.enableGossipCompressionDesc,
    messages.gossipPort,
    messages.gossipPortDesc,
];

export default class ClusterSettings extends OLDAdminSettings<Props, State> {
    getConfigFromState = (config: AdminConfig) => {
        config.ClusterSettings.Enable = this.state.Enable;
        config.ClusterSettings.ClusterName = this.state.ClusterName;
        config.ClusterSettings.OverrideHostname = this.state.OverrideHostname;
        config.ClusterSettings.UseIPAddress = this.state.UseIPAddress;
        config.ClusterSettings.EnableExperimentalGossipEncryption = this.state.EnableExperimentalGossipEncryption;
        config.ClusterSettings.EnableGossipCompression = this.state.EnableGossipCompression;
        config.ClusterSettings.GossipPort = this.parseIntNonZero(this.state.GossipPort, 8074);
        return config;
    };

    getStateFromConfig(config: AdminConfig) {
        const settings = config.ClusterSettings;

        return {
            Enable: settings.Enable,
            ClusterName: settings.ClusterName,
            OverrideHostname: settings.OverrideHostname,
            UseIPAddress: settings.UseIPAddress,
            EnableExperimentalGossipEncryption: settings.EnableExperimentalGossipEncryption,
            EnableGossipCompression: settings.EnableGossipCompression,
            GossipPort: settings.GossipPort,
            showWarning: false,
        };
    }

    renderTitle() {
        return (<FormattedMessage {...messages.cluster}/>);
    }

    overrideHandleChange = (id: string, value: unknown) => {
        this.setState({
            showWarning: true,
        });

        this.handleChange(id, value);
    };

    renderSettings = () => {
        const licenseEnabled = this.props.license.IsLicensed === 'true' && this.props.license.Cluster === 'true';
        if (!licenseEnabled) {
            return (<></>);
        }

        let configLoadedFromCluster = null;

        if (Client4.clusterId) {
            configLoadedFromCluster = (
                <div
                    style={style.configLoadedFromCluster}
                    className='alert alert-warning'
                >
                    <WarningIcon/>
                    <FormattedMessage
                        id='admin.cluster.loadedFrom'
                        defaultMessage='This configuration file was loaded from Node ID {clusterId}. Please see the Troubleshooting Guide in our <link>documentation</link> if you are accessing the System Console through a load balancer and experiencing issues.'
                        values={{
                            clusterId: Client4.clusterId,
                            link: (msg) => (
                                <ExternalLink
                                    location='cluster_settings'
                                    href={DocLinks.HIGH_AVAILABILITY_CLUSTER}
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </div>
            );
        }

        let warning = null;

        if (this.state.showWarning) {
            warning = (
                <div
                    style={style.warning}
                    className='alert alert-warning'
                >
                    <WarningIcon/>
                    <FormattedMessage
                        id='admin.cluster.should_not_change'
                        defaultMessage='WARNING: These settings may not sync with the other servers in the cluster. High Availability inter-node communication will not start until you modify the config.json to be identical on all servers and restart Mattermost. Please see the <link>documentation</link> on how to add or remove a server from the cluster. If you are accessing the System Console through a load balancer and experiencing issues, please see the Troubleshooting Guide in our <link>documentation</link>.'
                        values={{
                            link: (msg) => (
                                <ExternalLink
                                    location='cluster_settings'
                                    href={DocLinks.HIGH_AVAILABILITY_CLUSTER}
                                >
                                    {msg}
                                </ExternalLink>
                            ),
                        }}
                    />
                </div>
            );
        }

        let clusterTableContainer: React.ReactNode = null;
        if (this.state.Enable) {
            clusterTableContainer = (<ClusterTableContainer/>);
        }

        return (
            <SettingsGroup>
                {configLoadedFromCluster}
                {clusterTableContainer}
                <div className='banner'>
                    <FormattedMessage {...messages.noteDescription}/>
                </div>
                {warning}
                <BooleanSetting
                    id='Enable'
                    label={
                        <FormattedMessage {...messages.enableTitle}/>
                    }
                    helpText={
                        <FormattedMessage
                            {...messages.enableDescription}
                            values={{
                                link: (msg) => (
                                    <ExternalLink
                                        location='cluster_settings'
                                        href={DocLinks.HIGH_AVAILABILITY_CLUSTER}
                                    >
                                        {msg}
                                    </ExternalLink>
                                ),
                            }}
                        />
                    }
                    value={this.state.Enable}
                    onChange={this.overrideHandleChange}
                    setByEnv={this.isSetByEnv('ClusterSettings.Enable')}
                    disabled={this.props.isDisabled}
                />
                <TextSetting
                    id='ClusterName'
                    label={<FormattedMessage {...messages.clusterName}/>}
                    placeholder={defineMessage({id: 'admin.cluster.ClusterNameEx', defaultMessage: 'E.g.: "Production" or "Staging"'})}
                    helpText={<FormattedMessage {...messages.clusterNameDesc}/>}
                    value={this.state.ClusterName}
                    onChange={this.overrideHandleChange}
                    setByEnv={this.isSetByEnv('ClusterSettings.ClusterName')}
                    disabled={this.props.isDisabled}
                />
                <TextSetting
                    id='OverrideHostname'
                    label={<FormattedMessage {...messages.overrideHostname}/>}
                    placeholder={defineMessage({id: 'admin.cluster.OverrideHostnameEx', defaultMessage: 'E.g.: "app-server-01"'})}
                    helpText={<FormattedMessage {...messages.overrideHostnameDesc}/>}
                    value={this.state.OverrideHostname}
                    onChange={this.overrideHandleChange}
                    setByEnv={this.isSetByEnv('ClusterSettings.OverrideHostname')}
                    disabled={this.props.isDisabled}
                />
                <BooleanSetting
                    id='UseIPAddress'
                    label={<FormattedMessage {...messages.useIPAddress}/>}
                    helpText={<FormattedMessage {...messages.useIPAddressDesc}/>}
                    value={this.state.UseIPAddress}
                    onChange={this.overrideHandleChange}
                    setByEnv={this.isSetByEnv('ClusterSettings.UseIPAddress')}
                    disabled={this.props.isDisabled}
                />
                <BooleanSetting
                    id='EnableExperimentalGossipEncryption'
                    label={<FormattedMessage {...messages.enableExperimentalGossipEncryption}/>}
                    helpText={<FormattedMessage {...messages.enableExperimentalGossipEncryptionDesc}/>}
                    value={this.state.EnableExperimentalGossipEncryption}
                    onChange={this.overrideHandleChange}
                    setByEnv={this.isSetByEnv('ClusterSettings.EnableExperimentalGossipEncryption')}
                    disabled={this.props.isDisabled}
                />
                <BooleanSetting
                    id='EnableGossipCompression'
                    label={<FormattedMessage {...messages.enableGossipCompression}/>}
                    helpText={<FormattedMessage {...messages.enableGossipCompressionDesc}/>}
                    value={this.state.EnableGossipCompression}
                    onChange={this.overrideHandleChange}
                    setByEnv={this.isSetByEnv('ClusterSettings.EnableGossipCompression')}
                    disabled={this.props.isDisabled}
                />
                <TextSetting
                    id='GossipPort'
                    label={<FormattedMessage {...messages.gossipPort}/>}
                    placeholder={defineMessage({id: 'admin.cluster.GossipPortEx', defaultMessage: 'E.g.: "8074"'})}
                    helpText={<FormattedMessage {...messages.gossipPortDesc}/>}
                    value={this.state.GossipPort}
                    onChange={this.overrideHandleChange}
                    setByEnv={this.isSetByEnv('ClusterSettings.GossipPort')}
                    disabled={this.props.isDisabled}
                />
            </SettingsGroup>
        );
    };
}

const style = {
    configLoadedFromCluster: {marginBottom: 10},
    warning: {marginBottom: 10},
};
