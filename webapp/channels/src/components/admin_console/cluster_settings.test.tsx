// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';
import {ClusterSettings as ClusterSettingsType} from '@mattermost/types/config';

import ClusterSettings from 'components/admin_console/cluster_settings';

describe('components/ClusterSettings', () => {
    const baseProps = {
        license: {
            IsLicensed: 'true',
            Cluster: 'true',
        },
    };
    test('should match snapshot, encryption disabled', () => {
        const config: { ClusterSettings: Partial<ClusterSettingsType> } = {
            ClusterSettings: {
                Enable: true,
                ClusterName: 'test',
                OverrideHostname: '',
                UseIPAddress: false,
                EnableExperimentalGossipEncryption: false,
                EnableGossipCompression: false,
                GossipPort: 8074,
                StreamingPort: 8075,
            },
        };

        const props = {
            ...baseProps,
            config,
        };

        const wrapper = shallow(
            <ClusterSettings
                license={props.license}
                config={props.config}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('#EnableExperimentalGossipEncryption').prop('value')).toBe(false);
    });

    test('should match snapshot, encryption enabled', () => {
        const props = {
            ...baseProps,
            config: {
                ClusterSettings: {
                    Enable: true,
                    ClusterName: 'test',
                    OverrideHostname: '',
                    UseIPAddress: false,
                    EnableExperimentalGossipEncryption: true,
                    EnableGossipCompression: false,
                    GossipPort: 8074,
                    StreamingPort: 8075,
                },
            },
        };

        const wrapper = shallow(
            <ClusterSettings
                license={props.license}
                config={props.config}
            />,
        );
        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('#EnableExperimentalGossipEncryption').prop('value')).toBe(true);
    });

    test('should match snapshot, compression enabled', () => {
        const props = {
            ...baseProps,
            config: {
                ClusterSettings: {
                    Enable: true,
                    ClusterName: 'test',
                    OverrideHostname: '',
                    UseIPAddress: false,
                    EnableExperimentalGossipEncryption: false,
                    EnableGossipCompression: true,
                    GossipPort: 8074,
                    StreamingPort: 8075,
                },
            },
        };

        const wrapper = shallow(
            <ClusterSettings
                license={props.license}
                config={props.config}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('#EnableGossipCompression').prop('value')).toBe(true);
    });

    test('should match snapshot, compression disabled', () => {
        const props = {
            ...baseProps,
            config: {
                ClusterSettings: {
                    Enable: true,
                    ClusterName: 'test',
                    OverrideHostname: '',
                    UseIPAddress: false,
                    EnableExperimentalGossipEncryption: false,
                    EnableGossipCompression: false,
                    GossipPort: 8074,
                    StreamingPort: 8075,
                },
            },
        };

        const wrapper = shallow(
            <ClusterSettings
                license={props.license}
                config={props.config}
            />,
        );

        expect(wrapper).toMatchSnapshot();

        expect(wrapper.find('#EnableGossipCompression').prop('value')).toBe(false);
    });
});
