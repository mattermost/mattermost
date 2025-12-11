// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/vitest_react_testing_utils';

import Completed from './onboarding_tasklist_completed';

const dismissMockFn = vi.fn();

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

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test('should match snapshot', () => {
        const {container} = renderWithContext(<Completed {...props}/>, initialState);
        expect(container).toMatchSnapshot();
    });

    test('finds the completed subtitle', () => {
        renderWithContext(<Completed {...props}/>, initialState);

        // The component shows "We hope Mattermost is more familiar now." as subtitle
        expect(screen.getByText(/We hope Mattermost is more familiar now/i)).toBeInTheDocument();
    });

    test('displays the no thanks option to close the onboarding list', () => {
        renderWithContext(<Completed {...props}/>, initialState);

        // Find the "No, thanks" button (shown when trial conditions are met)
        const noThanksButton = screen.getByText(/No, thanks/i);
        expect(noThanksButton).toBeInTheDocument();

        // calls the dismiss function on click
        fireEvent.click(noThanksButton);
        expect(dismissMockFn).toHaveBeenCalledTimes(1);
    });
});
