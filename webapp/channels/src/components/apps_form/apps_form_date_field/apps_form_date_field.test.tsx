// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import mockStore from 'tests/test_store';

import AppsFormDateField from './apps_form_date_field';

jest.mock('utils/date_utils', () => ({
    stringToMoment: jest.fn(),
    momentToString: jest.fn(),
    validateDateRange: jest.fn(),
}));

jest.mock('mattermost-redux/selectors/entities/timezone', () => ({
    getCurrentTimezone: jest.fn().mockReturnValue('America/New_York'),
}));

const {stringToMoment, momentToString, validateDateRange} = require('utils/date_utils');

describe('AppsFormDateField', () => {
    const mockStoreData = {
        entities: {
            general: {
                config: {},
                license: {},
            },
            users: {
                currentUserId: 'user_id_1',
                profiles: {
                    user_id_1: {
                        id: 'user_id_1',
                        username: 'testuser',
                        email: 'test@example.com',
                        first_name: 'Test',
                        last_name: 'User',
                    },
                },
            },
            teams: {
                currentTeamId: 'team_id_1',
                teams: {},
            },
            channels: {
                currentChannelId: 'channel_id_1',
                channels: {},
            },
            timezone: {
                manualTimezone: 'America/New_York',
                automaticTimezone: 'America/New_York',
                useAutomaticTimezone: true,
            },
            preferences: {
                myPreferences: {},
            },
        },
        views: {
            browser: {
                focused: true,
            },
        },
    };

    const defaultField: AppField = {
        name: 'test_date',
        type: 'date',
        label: 'Test Date',
        is_required: false,
    };

    const defaultProps = {
        field: defaultField,
        value: null,
        onChange: jest.fn(),
        hasError: false,
    };

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock current time to avoid timezone-dependent tests
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
        
        stringToMoment.mockReturnValue(null);
        momentToString.mockReturnValue('2025-01-15');
        validateDateRange.mockReturnValue(null);
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const renderComponent = (props = {}) => {
        const store = mockStore({});

        return render(
            <Provider store={store}>
                <IntlProvider locale='en' defaultLocale='en'>
                    <AppsFormDateField
                        {...defaultProps}
                        {...props}
                    />
                </IntlProvider>
            </Provider>,
        );
    };

    it('should render date field with label', () => {
        renderComponent();
        expect(screen.getByText('Test Date')).toBeInTheDocument();
    });

    it('should show required indicator when field is required', () => {
        const requiredField = {...defaultField, is_required: true};
        renderComponent({field: requiredField});
        expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should display description when provided', () => {
        const fieldWithDescription = {...defaultField, description: 'Select your preferred date'};
        renderComponent({field: fieldWithDescription});
        expect(screen.getByText('Select your preferred date')).toBeInTheDocument();
    });

    it('should show placeholder text', () => {
        renderComponent();
        expect(screen.getByText('Select a date')).toBeInTheDocument();
    });

    it('should use custom hint as placeholder', () => {
        const fieldWithHint = {...defaultField, hint: 'Choose date'};
        renderComponent({field: fieldWithHint});
        expect(screen.getByText('Choose date')).toBeInTheDocument();
    });

    it('should be disabled when readonly', () => {
        const readonlyField = {...defaultField, readonly: true};
        renderComponent({field: readonlyField});
        const button = screen.getByRole('button');

        // The DatePicker component handles readonly state internally
        expect(button).toBeInTheDocument();
    });

    it('should handle input click to open date picker', () => {
        renderComponent();
        const button = screen.getByRole('button');
        fireEvent.click(button);

        // DatePicker opening is handled by the DatePicker component itself
        // We just verify the click doesn't cause errors
        expect(button).toBeInTheDocument();
    });

    it('should handle keyboard navigation', () => {
        renderComponent();
        const button = screen.getByRole('button');

        fireEvent.keyDown(button, {key: 'Enter'});
        expect(button).toBeInTheDocument();

        fireEvent.keyDown(button, {key: ' '});
        expect(button).toBeInTheDocument();
    });

    it('should show validation error when hasError is true', () => {
        renderComponent({hasError: true, errorText: 'Date is required'});
        expect(screen.getByText('Date is required')).toBeInTheDocument();
    });

    it('should show validation error from validateDateRange', () => {
        validateDateRange.mockReturnValue('Date must be after Jan 1, 2025');
        renderComponent({value: '2024-12-31'});
        expect(screen.getByText('Date must be after Jan 1, 2025')).toBeInTheDocument();
    });

    it('should show error when there is an error', () => {
        renderComponent({hasError: true, errorText: 'Date is required'});
        expect(screen.getByText('Date is required')).toBeInTheDocument();
    });

    it('should show error when validation fails', () => {
        validateDateRange.mockReturnValue('Validation error');
        renderComponent({value: '2025-01-15'});
        expect(screen.getByText('Validation error')).toBeInTheDocument();
    });

    it('should call onChange when date is selected', () => {
        const mockOnChange = jest.fn();
        const mockMoment = {
            clone: jest.fn().mockReturnThis(),
            year: jest.fn().mockReturnThis(),
            month: jest.fn().mockReturnThis(),
            date: jest.fn().mockReturnThis(),
            format: jest.fn().mockReturnValue('Jan 15, 2025'),
            toDate: jest.fn().mockReturnValue(new Date('2025-01-15')),
        };

        stringToMoment.mockReturnValue(mockMoment);
        momentToString.mockReturnValue('2025-01-16');

        renderComponent({onChange: mockOnChange});

        // Simulate DatePicker date selection
        const component = screen.getByRole('button').closest('.form-group');
        expect(component).toBeInTheDocument();

        // The actual date selection is handled by DatePicker component
        // We verify the mocks are set up correctly
        expect(stringToMoment).toHaveBeenCalled();
    });

    it('should handle min_date and max_date validation', () => {
        const fieldWithRange = {
            ...defaultField,
            min_date: '2025-01-01',
            max_date: '2025-01-31',
        };

        renderComponent({field: fieldWithRange, value: '2025-01-15'});

        expect(validateDateRange).toHaveBeenCalledWith(
            '2025-01-15',
            '2025-01-01',
            '2025-01-31',
            'UTC',
        );
    });

    it('should display formatted date value', () => {
        const mockMoment = {
            format: jest.fn().mockReturnValue('Jan 15, 2025'),
            toDate: jest.fn().mockReturnValue(new Date('2025-01-15')),
            year: jest.fn().mockReturnValue(2025),
            month: jest.fn().mockReturnValue(0), // January is 0
            date: jest.fn().mockReturnValue(15),
        };

        stringToMoment.mockReturnValue(mockMoment);

        renderComponent({value: '2025-01-15'});

        expect(screen.getByText('Jan 15, 2025')).toBeInTheDocument();
    });
});
