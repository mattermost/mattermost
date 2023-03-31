// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useHistory} from 'react-router-dom';

import {shallow} from 'enzyme';

import {trackEvent} from 'actions/telemetry_actions.jsx';

import TrialBenefitsModalStepMore from 'components/trial_benefits_modal/trial_benefits_modal_step_more';

import {TELEMETRY_CATEGORIES} from 'utils/constants';

jest.mock('react-router-dom', () => {
    const original = jest.requireActual('react-router-dom');

    return {
        ...original,
        useHistory: jest.fn().mockReturnValue({
            push: jest.fn(),
        }),
    };
});

jest.mock('actions/telemetry_actions.jsx', () => {
    const original = jest.requireActual('actions/telemetry_actions.jsx');
    return {
        ...original,
        trackEvent: jest.fn(),
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
        expect(trackEvent).toHaveBeenCalledWith(TELEMETRY_CATEGORIES.SELF_HOSTED_START_TRIAL_MODAL, 'benefits_modal_section_opened_thing');
    });
});
