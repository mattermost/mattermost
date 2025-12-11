// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import TrialBenefitsModalStepMore from 'components/trial_benefits_modal/trial_benefits_modal_step_more';

import {render, screen, fireEvent} from 'tests/vitest_react_testing_utils';

const mockHistoryPush = vi.fn();

vi.mock('react-router-dom', async () => {
    const original = await vi.importActual('react-router-dom');

    return {
        ...original,
        useHistory: () => ({
            push: mockHistoryPush,
        }),
    };
});

describe('components/trial_benefits_modal/trial_benefits_modal_step_more', () => {
    const props = {
        id: 'thing',
        route: '/test/page',
        message: 'Test Message',
    };

    test('should match snapshot', () => {
        const {container} = render(
            <MemoryRouter>
                <TrialBenefitsModalStepMore {...props}/>
            </MemoryRouter>,
        );
        expect(container).toMatchSnapshot();
    });

    test('should handle on click', () => {
        const mockOnClick = vi.fn();

        render(
            <MemoryRouter>
                <TrialBenefitsModalStepMore
                    {...props}
                    onClick={mockOnClick}
                />
            </MemoryRouter>,
        );

        fireEvent.click(screen.getByText(props.message));

        expect(mockHistoryPush).toHaveBeenCalledWith(props.route);
        expect(mockOnClick).toHaveBeenCalled();
    });
});
