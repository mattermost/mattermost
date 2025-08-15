// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';
import {useHistory} from 'react-router-dom';

import TrialBenefitsModalStepMore from 'components/trial_benefits_modal/trial_benefits_modal_step_more';

jest.mock('react-router-dom', () => {
    const original = jest.requireActual('react-router-dom');

    return {
        ...original,
        useHistory: jest.fn().mockReturnValue({
            push: jest.fn(),
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
        const wrapper = shallow(
            <TrialBenefitsModalStepMore {...props}/>,
        );
        expect(wrapper).toMatchSnapshot();
    });

    test('should handle on click', () => {
        const mockHistory = useHistory();
        const mockOnClick = jest.fn();

        const wrapper = shallow(
            <TrialBenefitsModalStepMore
                {...props}
                onClick={mockOnClick}
            />,
        );

        wrapper.find('.learn-more-button').simulate('click');

        expect(mockHistory.push).toHaveBeenCalledWith(props.route);
        expect(mockOnClick).toHaveBeenCalled();
    });
});
