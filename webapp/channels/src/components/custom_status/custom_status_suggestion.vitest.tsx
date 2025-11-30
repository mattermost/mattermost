// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {CustomStatusDuration} from '@mattermost/types/users';

import {renderWithContext, fireEvent} from 'tests/vitest_react_testing_utils';

import CustomStatusSuggestion from './custom_status_suggestion';

describe('components/custom_status/custom_status_emoji', () => {
    const baseProps = {
        handleSuggestionClick: vi.fn(),
        status: {
            emoji: '',
            text: '',
            duration: CustomStatusDuration.DONT_CLEAR,
        },
        handleClear: vi.fn(),
    };

    it('should match snapshot', () => {
        const {container} = renderWithContext(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        expect(container.querySelector('.statusSuggestion__row')).toBeInTheDocument();
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

        expect(container.querySelector('.statusSuggestion__row')).toBeInTheDocument();
        expect(container.querySelector('.statusSuggestion__duration')).toBeInTheDocument();
    });

    it('should call handleSuggestionClick when click occurs on div', () => {
        const handleSuggestionClick = vi.fn();
        const {container} = renderWithContext(
            <CustomStatusSuggestion
                {...baseProps}
                handleSuggestionClick={handleSuggestionClick}
            />,
        );

        const row = container.querySelector('.statusSuggestion__row');
        fireEvent.click(row!);

        expect(handleSuggestionClick).toHaveBeenCalledTimes(1);
    });

    it('should render clearButton when hover occurs on div', () => {
        const {container} = renderWithContext(
            <CustomStatusSuggestion {...baseProps}/>,
        );

        expect(container.querySelector('.suggestion-clear')).not.toBeInTheDocument();

        const row = container.querySelector('.statusSuggestion__row');
        fireEvent.mouseEnter(row!);

        expect(container.querySelector('.suggestion-clear')).toBeInTheDocument();
    });
});
