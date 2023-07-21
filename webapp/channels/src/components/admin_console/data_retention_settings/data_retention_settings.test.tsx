// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import DataRetentionSettings from './data_retention_settings';

describe('components/admin_console/data_retention_settings/data_retention_settings', () => {
    const baseProps = {
        config: {
            DataRetentionSettings: {
                EnableMessageDeletion: true,
                EnableFileDeletion: true,
                EnableBoardsDeletion: true,
                MessageRetentionDays: 100,
                FileRetentionDays: 100,
                BoardsRetentionDays: 100,
                DeletionJobStartTime: '00:15',
            },
        },
        customPolicies: {},
        customPoliciesCount: 0,
        actions: {
            getDataRetentionCustomPolicies: jest.fn().mockResolvedValue([]),
            createJob: jest.fn(),
            getJobsByType: jest.fn().mockResolvedValue([]),
            deleteDataRetentionCustomPolicy: jest.fn(),
            updateConfig: jest.fn(),
        },
    };

    test('should match snapshot with no custom policies', () => {
        const wrapper = shallow(
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
        const wrapper = shallow(
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
        const wrapper = shallow(
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
        props.config.DataRetentionSettings.EnableBoardsDeletion = false;
        const wrapper = shallow(
            <DataRetentionSettings
                {...props}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
