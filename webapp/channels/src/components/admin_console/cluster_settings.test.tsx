// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';
import ClusterSettings from 'components/admin_console/cluster_settings';

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
            />
        );
        
        // Verify the form title is rendered
        expect(screen.getByText('High Availability')).toBeInTheDocument();
        
        // Verify the cluster settings fields are displayed
        expect(screen.getByText('Enable High Availability Mode:')).toBeInTheDocument();
        expect(screen.getByText('Cluster Name:')).toBeInTheDocument();
        expect(screen.getByText('Override Hostname:')).toBeInTheDocument();
        expect(screen.getByText('Use IP Address:')).toBeInTheDocument();
        
        // Verify encryption is disabled
        const encryptionSetting = screen.getByLabelText('Enable Experimental Gossip encryption:');
        expect(encryptionSetting).not.toBeChecked();
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
            />
        );
        
        // Verify encryption is enabled
        const encryptionSetting = screen.getByLabelText('Enable Experimental Gossip encryption:');
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
            />
        );
        
        // Verify compression is enabled
        const compressionSetting = screen.getByLabelText('Enable Gossip compression:');
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
            />
        );
        
        // Verify compression is disabled
        const compressionSetting = screen.getByLabelText('Enable Gossip compression:');
        expect(compressionSetting).not.toBeChecked();
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
            />
        );
        
        // Verify text field values
        expect(screen.getByDisplayValue('test-cluster')).toBeInTheDocument();
        expect(screen.getByDisplayValue('test-host')).toBeInTheDocument();
        expect(screen.getByDisplayValue('9000')).toBeInTheDocument();
    });
});
