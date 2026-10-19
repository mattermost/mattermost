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
    test('should match snapshot, encryption disabled', () => {
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
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip encryption:')).toBeInTheDocument();
    });

    test('should match snapshot, encryption enabled', () => {
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
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip encryption:')).toBeInTheDocument();
    });

    test('should match snapshot, compression enabled', () => {
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
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip compression:')).toBeInTheDocument();
    });

    test('should match snapshot, compression disabled', () => {
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
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        expect(screen.getByText('Enable Gossip compression:')).toBeInTheDocument();
    });

    test('renders GossipPort as native type=number Compass input', () => {
        const config = {
            ClusterSettings: {
                Enable: true,
                ClusterName: 'test',
                OverrideHostname: '',
                UseIPAddress: false,
                EnableGossipEncryption: false,
                EnableGossipCompression: false,
                GossipPort: 8074,
            },
        };
        renderWithContext(
            <ClusterSettings
                {...baseProps}
                value={[]}
                config={config}
            />,
        );

        const input = screen.getByTestId('GossipPortnumber');
        expect(input).toHaveAttribute('type', 'number');
        expect(input).toHaveAttribute('id', 'GossipPort');
        expect(input).toHaveAttribute('min', '1');
        expect(input).toHaveAttribute('max', '65535');
        expect(input).not.toHaveClass('form-control');

        const fieldRoot = input.closest('.Input_container');
        expect(fieldRoot).toBeInTheDocument();
        expect(fieldRoot!.querySelector('legend')).not.toBeInTheDocument();
    });
});
