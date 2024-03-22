// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallowWithIntl} from 'tests/helpers/intl-test-helper';

import DataRetentionSettings from './data_retention_settings';

describe('components/admin_console/data_retention_settings/data_retention_settings', () => {
    const baseProps = {
        config: {
            DataRetentionSettings: {
                EnableMessageDeletion: true,
                EnableFileDeletion: true,
                MessageRetentionDays: 100,
                MessageRetentionHours: 2400,
                FileRetentionDays: 100,
                FileRetentionHours: 2400,
                DeletionJobStartTime: '00:15',
            },
        },
        customPolicies: {},
        customPoliciesCount: 0,
        globalMessageRetentionHours: '2400',
        globalFileRetentionHours: '2400',
        actions: {
            getDataRetentionCustomPolicies: jest.fn().mockResolvedValue([]),
            createJob: jest.fn(),
            getJobsByType: jest.fn().mockResolvedValue([]),
            deleteDataRetentionCustomPolicy: jest.fn(),
            patchConfig: jest.fn(),
        },
    };

    test('should match snapshot with no custom policies', () => {
        const wrapper = shallowWithIntl(
            <DataRetentionSettings
                {...baseProps}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom policy', () => {
        const props = baseProps;
        props.customPolicies = {
            1234567: {
                id: '1234567',
                display_name: 'Custom policy 1',
                post_duration: 60,
                team_count: 1,
                channel_count: 2,
            },
        };
        props.customPoliciesCount = 1;
        const wrapper = shallowWithIntl(
            <DataRetentionSettings
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with custom policy keep forever', () => {
        const props = baseProps;
        props.customPolicies = {
            1234567: {
                id: '1234567',
                display_name: 'Custom policy 1',
                post_duration: -1,
                team_count: 1,
                channel_count: 2,
            },
        };
        props.customPoliciesCount = 1;
        const wrapper = shallowWithIntl(
            <DataRetentionSettings
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with Global Policies disabled', () => {
        const props = baseProps;
        props.config.DataRetentionSettings.EnableMessageDeletion = false;
        props.config.DataRetentionSettings.EnableFileDeletion = false;
        const wrapper = shallowWithIntl(
            <DataRetentionSettings
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
