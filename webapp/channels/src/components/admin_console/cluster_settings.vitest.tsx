// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import ClusterSettings from 'components/admin_console/cluster_settings';

import {screen, renderWithContext} from 'tests/vitest_react_testing_utils';

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
                SteamingPort: 8075,
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        // Instead of wrapper.find('#EnableGossipEncryption').prop('value'), check the radio button
        const encryptionFalseRadio = screen.getByTestId('EnableGossipEncryptionfalse') as HTMLInputElement;
        expect(encryptionFalseRadio.checked).toBe(true);
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
                SteamingPort: 8075,
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        // Instead of wrapper.find('#EnableGossipEncryption').prop('value'), check the radio button
        const encryptionTrueRadio = screen.getByTestId('EnableGossipEncryptiontrue') as HTMLInputElement;
        expect(encryptionTrueRadio.checked).toBe(true);
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
                SteamingPort: 8075,
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        // Instead of wrapper.find('#EnableGossipCompression').prop('value'), check the radio button
        const compressionTrueRadio = screen.getByTestId('EnableGossipCompressiontrue') as HTMLInputElement;
        expect(compressionTrueRadio.checked).toBe(true);
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
                SteamingPort: 8075,
            },
        };
        const {container} = renderWithContext(
            <ClusterSettings
                {...props}
                config={config}
            />,
        );
        expect(container).toMatchSnapshot();

        // Instead of wrapper.find('#EnableGossipCompression').prop('value'), check the radio button
        const compressionFalseRadio = screen.getByTestId('EnableGossipCompressionfalse') as HTMLInputElement;
        expect(compressionFalseRadio.checked).toBe(true);
    });
});
