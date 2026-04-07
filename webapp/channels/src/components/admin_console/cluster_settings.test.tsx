// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ClusterSettings from 'components/admin_console/cluster_settings';

import {renderWithContext, screen} from 'tests/react_testing_utils';

describe('components/ClusterSettings', () => {
    const baseProps = {
        license: {
            IsLicensed: 'true',
            Cluster: 'true',
        },
    };
    test('should match snapshot, encryption disabled', async () => {
        const props = {
            ...baseProps,
            value: [],
        };
        const config = {
            ClusterSettings: {
                Enable: true,
                ClusterName: 'test',
                OverrideHostname: '',
                UseIPAddress: false,
                EnableGossipEncryption: false,
                EnableGossipCompression: false,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };
        const {container} = await renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip encryption:')).toBeInTheDocument();
    });

    test('should match snapshot, encryption enabled', async () => {
        const props = {
            ...baseProps,
            value: [],
        };
        const config = {
            ClusterSettings: {
                Enable: true,
                ClusterName: 'test',
                OverrideHostname: '',
                UseIPAddress: false,
                EnableGossipEncryption: true,
                EnableGossipCompression: false,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };
        const {container} = await renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip encryption:')).toBeInTheDocument();
    });

    test('should match snapshot, compression enabled', async () => {
        const props = {
            ...baseProps,
            value: [],
        };
        const config = {
            ClusterSettings: {
                Enable: true,
                ClusterName: 'test',
                OverrideHostname: '',
                UseIPAddress: false,
                EnableGossipEncryption: false,
                EnableGossipCompression: true,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };
        const {container} = await renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip compression:')).toBeInTheDocument();
    });

    test('should match snapshot, compression disabled', async () => {
        const props = {
            ...baseProps,
            value: [],
        };
        const config = {
            ClusterSettings: {
                Enable: true,
                ClusterName: 'test',
                OverrideHostname: '',
                UseIPAddress: false,
                EnableGossipEncryption: false,
                EnableGossipCompression: false,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };
        const {container} = await renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip compression:')).toBeInTheDocument();
    });
});
