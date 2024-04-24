// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import GlobalPolicyForm from 'components/admin_console/data_retention_settings/global_policy_form/global_policy_form';

describe('components/PluginManagement', () => {
    const defaultProps = {
        config: {
            DataRetentionSettings: {
                EnableMessageDeletion: true,
                EnableFileDeletion: true,
                MessageRetentionHours: 1440,
                FileRetentionHours: 960,
                DeletionJobStartTime: '10:00',
            },
        },
        messageRetentionHours: '2400',
        fileRetentionHours: '2400',
        environmentConfig: {},
        actions: {
            patchConfig: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const props = {...defaultProps};
        const wrapper = shallow(<GlobalPolicyForm {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
