// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';

import Completed from './onboarding_tasklist_completed';

jest.mock('mattermost-redux/actions/admin', () => ({
    ...jest.requireActual('mattermost-redux/actions/admin'),
    getPrevTrialLicense: () => ({type: 'MOCK_GET_PREV_TRIAL_LICENSE'}),
}));

jest.mock('components/common/hooks/useOpenStartTrialFormModal', () => ({
    __esModule: true,
    default: () => jest.fn(),
}));

const dismissMockFn = jest.fn();

describe('components/onboarding_tasklist/onboarding_tasklist_completed.tsx', () => {
    const props = {
        dismissAction: dismissMockFn,
        isCurrentUserSystemAdmin: true,
        isFirstAdmin: true,
    };

    const initialState = {
        entities: {
            admin: {
                prevTrialLicense: {
                    IsLicensed: 'false',
                },
            },
            general: {
                license: {
                    IsLicensed: 'false',
                },
            },
            cloud: {
                subscription: {
                    product_id: 'prod_professional',
                    is_free_trial: 'false',
                    trial_end_at: 1,
                },
            },
        },
    };

    test('should match snapshot', () => {
        const {container} = renderWithContext(<Completed {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('finds the completed subtitle', () => {
        const {container} = renderWithContext(<Completed {...props}/>, initialState);
        expect(container.querySelectorAll('.completed-subtitle')).toHaveLength(1);
    });

    test('displays the no thanks option to close the onboarding list', async () => {
        const {container} = renderWithContext(<Completed {...props}/>, initialState);
        const noThanksLink = container.querySelectorAll('.no-thanks-link');
        expect(noThanksLink).toHaveLength(1);

        // calls the dissmiss function on click
        await userEvent.click(noThanksLink[0]);
        expect(dismissMockFn).toHaveBeenCalledTimes(1);
    });
});
