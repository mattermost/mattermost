// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import GlobalPolicyForm from 'components/admin_console/data_retention_settings/global_policy_form/global_policy_form';

import {renderWithContext, screen} from 'tests/react_testing_utils';

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
        const {container} = renderWithContext(<GlobalPolicyForm {...props}/>);

        expect(screen.getByText('Global Retention Policy')).toBeInTheDocument();
        expect(screen.getByText('Applies to all teams and channels, but does not apply to custom retention policies.')).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });
});
