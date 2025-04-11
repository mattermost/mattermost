// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen} from '@testing-library/react';
import React from 'react';

import ClusterSettings from 'components/admin_console/cluster_settings';

import {renderWithContext} from 'tests/react_testing_utils';

describe('components/ClusterSettings', () => {
    const baseProps = {
        license: {
            IsLicensed: 'true',
            Cluster: 'true',
        },
    };

    test('should render correctly with encryption disabled', () => {
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
                EnableExperimentalGossipEncryption: false,
                EnableGossipCompression: false,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };

        renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );

        // Verify the form title is rendered
        expect(screen.getByText('High Availability')).toBeInTheDocument();

        // Verify the cluster settings fields are displayed
        expect(screen.getByText('Enable High Availability Mode:')).toBeInTheDocument();
        expect(screen.getByText('Cluster Name:')).toBeInTheDocument();
        expect(screen.getByText('Override Hostname:')).toBeInTheDocument();
        expect(screen.getByText('Use IP Address:')).toBeInTheDocument();

        // Verify encryption is disabled
        const encryptionSetting = screen.getByTestId('EnableExperimentalGossipEncryptionfalse');
        expect(encryptionSetting).toBeChecked();
    });

    test('should render correctly with encryption enabled', () => {
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
                EnableExperimentalGossipEncryption: true,
                EnableGossipCompression: false,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };

        renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );

        // Verify encryption is enabled
        const encryptionSetting = screen.getByTestId('EnableExperimentalGossipEncryptiontrue');
        expect(encryptionSetting).toBeChecked();
    });

    test('should render correctly with compression enabled', () => {
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
                EnableExperimentalGossipEncryption: false,
                EnableGossipCompression: true,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };

        renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );

        // Verify compression is enabled
        const compressionSetting = screen.getByTestId('EnableGossipCompressiontrue');
        expect(compressionSetting).toBeChecked();
    });

    test('should render correctly with compression disabled', () => {
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
                EnableExperimentalGossipEncryption: false,
                EnableGossipCompression: false,
                GossipPort: 8074,
                SteamingPort: 8075,
            },
        };

        renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );

        // Verify compression is disabled
        // Find the EnableGossipCompression radio button directly by its test ID
        const compressionSetting = screen.getByTestId('EnableGossipCompressionfalse');
        expect(compressionSetting).toBeChecked();
    });

    test('should render correct input values for text fields', () => {
        const props = {
            ...baseProps,
            value: [],
        };
        const config = {
            ClusterSettings: {
                Enable: true,
                ClusterName: 'test-cluster',
                OverrideHostname: 'test-host',
                UseIPAddress: false,
                EnableExperimentalGossipEncryption: false,
                EnableGossipCompression: false,
                GossipPort: 9000,
                SteamingPort: 8075,
            },
        };

        renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );

        // Verify text field values - use the label text to find inputs
        expect(screen.getByLabelText('Cluster Name:').getAttribute('value')).toBe('test-cluster');
        expect(screen.getByLabelText('Override Hostname:').getAttribute('value')).toBe('test-host');
        expect(screen.getByLabelText('Gossip Port:').getAttribute('value')).toBe('9000');
    });
});
