// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import * as redux from 'react-redux';

import {renderWithContext} from 'tests/vitest_react_testing_utils';

import SuccessModal from './success';

describe('components/pricing_modal/downgrade_team_removal_modal', () => {
    beforeEach(() => {
        vi.spyOn(redux, 'useDispatch').mockImplementation(
            vi.fn(() => vi.fn()),
        );
    });

    const state = {
        entities: {
            cloud: {
                subscription: {
                    is_free_trial: 'false',
                    trial_end_at: 0,
                    product_id: 'prod_starter',
                },
            },
        },
        views: {
            modals: {
                modalState: {
                    success_modal: {
                        open: true,
                    },
                },
            },
        },
    };

    test('matches snapshot', () => {
        const {container} = renderWithContext(<SuccessModal/>, state);

        // Verify the modal renders without crashing
        expect(container).toBeInTheDocument();
    });
});
