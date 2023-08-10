// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {shallow} from 'enzyme';
import React from 'react';

import {CustomStatusDuration} from '@mattermost/types/users';

import CustomStatusSuggestion from './custom_status_suggestion';

describe('components/custom_status/custom_status_emoji', () => {
    const baseProps = {
        handleSuggestionClick: jest.fn(),
        status: {
            emoji: '',
            text: '',
            duration: CustomStatusDuration.DONT_CLEAR,
        },
        handleClear: jest.fn(),
    };

    it('should match snapshot', () => {
        const wrapper = shallow(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should match snapshot with duration', () => {
        const props = {
            ...baseProps,
            status: {
                ...baseProps.status,
                duration: CustomStatusDuration.TODAY,
            },
        };
        const wrapper = shallow(
            <CustomStatusSuggestion {...props}/>,
        );

        expect(wrapper).toMatchSnapshot();
    });

    it('should call handleSuggestionClick when click occurs on div', () => {
        const wrapper = shallow(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        wrapper.find('.statusSuggestion__row').simulate('click');
        expect(baseProps.handleSuggestionClick).toBeCalledTimes(1);
    });

    it('should render clearButton when hover occurs on div', () => {
        const wrapper = shallow(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        expect(wrapper.find('.suggestion-clear').exists()).toBeFalsy();
        wrapper.find('.statusSuggestion__row').simulate('mouseEnter');
        expect(wrapper.find('.suggestion-clear').exists()).toBeTruthy();
    });
});
