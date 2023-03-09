// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {shallow} from 'enzyme';

import CustomPolicyForm from 'components/admin_console/data_retention_settings/custom_policy_form/custom_policy_form';

describe('components/admin_console/data_retention_settings/custom_policy_form', () => {
    const defaultProps = {
        actions: {
            setNavigationBlocked: jest.fn(),
            fetchPolicy: jest.fn().mockResolvedValue([]),
            fetchPolicyTeams: jest.fn().mockResolvedValue([]),
            createDataRetentionCustomPolicy: jest.fn(),
            updateDataRetentionCustomPolicy: jest.fn(),
            addDataRetentionCustomPolicyTeams: jest.fn(),
            removeDataRetentionCustomPolicyTeams: jest.fn(),
            addDataRetentionCustomPolicyChannels: jest.fn(),
            removeDataRetentionCustomPolicyChannels: jest.fn(),
        },
    };

    test('should match snapshot with creating new policy', () => {
        const props = {...defaultProps};
        const wrapper = shallow(<CustomPolicyForm {...props}/>);
        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with editing existing policy', () => {
        const props = {...defaultProps};

        const wrapper = shallow(
            <CustomPolicyForm
                {...props}
                policyId='fsdgdsgdsgh'
                policy={{
                    id: 'fsdgdsgdsgh',
                    display_name: 'Test Policy',
                    post_duration: 22,
                    team_count: 1,
                    channel_count: 2,
                }}
            />,
        );
        expect(wrapper).toMatchSnapshot();
    });
});
