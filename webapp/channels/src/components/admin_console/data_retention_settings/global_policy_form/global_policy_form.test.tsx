// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import GlobalPolicyForm from 'components/admin_console/data_retention_settings/global_policy_form/global_policy_form';

describe('components/PluginManagement', () => {
    const defaultProps = {
        config: {
            DataRetentionSettings: {
                EnableMessageDeletion: true,
                EnableFileDeletion: true,
                MessageRetentionDays: 60,
                FileRetentionDays: 40,
                DeletionJobStartTime: '10:00',
            },
        },
        actions: {
            updateConfig: jest.fn(),
            setNavigationBlocked: jest.fn(),
        },
    };

    test('should match snapshot', () => {
        const props = {...defaultProps};
        const wrapper = shallow(<GlobalPolicyForm {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });
});
