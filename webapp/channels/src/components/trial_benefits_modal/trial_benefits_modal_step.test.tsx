// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {shallow} from 'enzyme';

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
        const wrapper = shallow(
            <TrialBenefitsModalStep {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    test('should match snapshot with optional params', () => {
        const wrapper = shallow(
            <TrialBenefitsModalStep
                {...props}
                bottomLeftMessage='Step bottom message'
                pageURL='/test/page'
                onClose={jest.fn()}
            />,
        );

        expect(wrapper).toMatchSnapshot();
    });
});
