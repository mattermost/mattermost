// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render} from '@testing-library/react';
import React from 'react';
import {MemoryRouter} from 'react-router-dom';
import {describe, test, expect, vi} from 'vitest';

import TrialBenefitsModalStep from 'components/trial_benefits_modal/trial_benefits_modal_step';

describe('components/trial_benefits_modal/trial_benefits_modal_step', () => {
    const props = {
        id: 'stepId',
        title: 'Step title',
        description: 'Step description',
        svgWrapperClassName: 'stepClassname',
        svgElement: <svg/>,
        buttonLabel: 'button',
    };

    test('should match snapshot', () => {
        const {container} = render(
            <MemoryRouter>
                <TrialBenefitsModalStep {...props}/>
            </MemoryRouter>,
        );

        expect(container).toMatchSnapshot();
    });

    test('should match snapshot with optional params', () => {
        const {container} = render(
            <MemoryRouter>
                <TrialBenefitsModalStep
                    {...props}
                    bottomLeftMessage='Step bottom message'
                    pageURL='/test/page'
                    onClose={vi.fn()}
                />
            </MemoryRouter>,
        );

        expect(container).toMatchSnapshot();
    });
});
