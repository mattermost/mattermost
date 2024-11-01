// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {defineMessages} from 'react-intl';

export const messages = defineMessages({
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
