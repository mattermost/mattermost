// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {fireEvent} from '@testing-library/react';
import React from 'react';

import {CustomStatusDuration} from '@mattermost/types/users';

import {renderWithContext} from 'tests/react_testing_utils';

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
        const {container} = renderWithContext(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should match snapshot with duration', () => {
        const props = {
            ...baseProps,
            status: {
                ...baseProps.status,
                duration: CustomStatusDuration.TODAY,
            },
        };
        const {container} = renderWithContext(
            <CustomStatusSuggestion {...props}/>,
        );

        expect(container).toMatchSnapshot();
    });

    it('should call handleSuggestionClick when click occurs on div', () => {
        const {container} = renderWithContext(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        fireEvent.click(container.querySelector('.statusSuggestion__row')!);
        expect(baseProps.handleSuggestionClick).toHaveBeenCalledTimes(1);
    });

    it('should render clearButton when hover occurs on div', () => {
        // Suppress the DOM nesting warning (button inside button) which is a component issue
        const originalError = console.error;
        console.error = jest.fn();

        const {container} = renderWithContext(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        expect(container.querySelector('.suggestion-clear')).not.toBeInTheDocument();
        fireEvent.mouseEnter(container.querySelector('.statusSuggestion__row')!);
        expect(container.querySelector('.suggestion-clear')).toBeInTheDocument();

        console.error = originalError;
    });
});
