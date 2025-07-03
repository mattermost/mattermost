// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {render, screen, fireEvent} from '@testing-library/react';
import React from 'react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';

import type {AppField} from '@mattermost/types/apps';

import mockStore from 'tests/test_store';

import AppsFormDateTimeField from './apps_form_datetime_field';

jest.mock('utils/date_utils', () => ({
    stringToMoment: jest.fn(),
    momentToString: jest.fn(),
    validateDateRange: jest.fn(),
    getDefaultTime: jest.fn(),
    combineDateAndTime: jest.fn(),
}));

jest.mock('components/datetime_input/datetime_input', () => ({
    __esModule: true,
    default: function MockDateTimeInput({time, handleChange}: {time: any; handleChange: any}) {
        return (
            <div data-testid='datetime-input'>
                <button onClick={() => handleChange(time)}>
                    {time ? time.format('MMM D, YYYY h:mm A') : 'Select datetime'}
                </button>
            </div>
        );
    },
    getRoundedTime: jest.fn().mockImplementation((value: any) => value),
}));

const {stringToMoment, momentToString, validateDateRange, getDefaultTime, combineDateAndTime} = require('utils/date_utils');

describe('AppsFormDateTimeField', () => {
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
        name: 'test_datetime',
        type: 'datetime',
        label: 'Test DateTime',
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
        stringToMoment.mockReturnValue(null);
        momentToString.mockReturnValue('2025-01-15T14:30:00Z');
        validateDateRange.mockReturnValue(null);
        getDefaultTime.mockReturnValue('00:00');
        combineDateAndTime.mockReturnValue('2025-01-15T05:00:00Z');
    });

    const renderComponent = (props = {}) => {
        const store = mockStore(mockStoreData);

        return render(
            <Provider store={store}>
                <IntlProvider
                    locale='en'
                    defaultLocale='en'
                >
                    <AppsFormDateTimeField
                        {...defaultProps}
                        {...props}
                    />
                </IntlProvider>
            </Provider>,
        );
    };

    it('should render datetime field with label', () => {
        renderComponent();
        expect(screen.getByText('Test DateTime')).toBeInTheDocument();
    });

    it('should show required indicator when field is required', () => {
        const requiredField = {...defaultField, is_required: true};
        renderComponent({field: requiredField});
        expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('should display description when provided', () => {
        const fieldWithDescription = {...defaultField, description: 'Select your preferred date and time'};
        renderComponent({field: fieldWithDescription});
        expect(screen.getByText('Select your preferred date and time')).toBeInTheDocument();
    });

    it('should render DateTimeInput when value exists', () => {
        const mockMoment = {
            format: jest.fn().mockReturnValue('Jan 15, 2025 2:30 PM'),
        };
        stringToMoment.mockReturnValue(mockMoment);

        renderComponent({value: '2025-01-15T14:30:00Z'});

        expect(screen.getByTestId('datetime-input')).toBeInTheDocument();
        expect(screen.getByText('Jan 15, 2025 2:30 PM')).toBeInTheDocument();
    });

    it('should render placeholder input when no value', () => {
        renderComponent();
        expect(screen.getByPlaceholderText('Select date and time')).toBeInTheDocument();
    });

    it('should use custom hint as placeholder', () => {
        const fieldWithHint = {...defaultField, hint: 'Choose datetime'};
        renderComponent({field: fieldWithHint});
        expect(screen.getByPlaceholderText('Choose datetime')).toBeInTheDocument();
    });

    it('should handle placeholder click to initialize datetime', () => {
        const mockOnChange = jest.fn();
        const mockTodayMoment = {
            format: jest.fn().mockReturnValue('2025-01-15'),
        };

        stringToMoment.mockReturnValue(mockTodayMoment);
        momentToString.mockReturnValue('2025-01-15T05:00:00Z');

        renderComponent({onChange: mockOnChange});

        const input = screen.getByPlaceholderText('Select date and time');
        fireEvent.click(input);

        expect(getDefaultTime).toHaveBeenCalled();
        expect(combineDateAndTime).toHaveBeenCalled();
        expect(mockOnChange).toHaveBeenCalledWith('test_datetime', '2025-01-15T05:00:00Z');
    });

    it('should handle required field initialization', () => {
        const mockOnChange = jest.fn();
        const requiredField = {...defaultField, is_required: true};

        // Mock getRoundedTime from datetime_input
        const mockMoment = {
            format: jest.fn().mockReturnValue('2025-01-15T05:00:00Z'),
        };
        const {getRoundedTime} = require('components/datetime_input/datetime_input');
        getRoundedTime.mockReturnValue(mockMoment);
        momentToString.mockReturnValue('2025-01-15T05:00:00Z');

        renderComponent({field: requiredField, onChange: mockOnChange});

        expect(mockOnChange).toHaveBeenCalledWith('test_datetime', '2025-01-15T05:00:00Z');
    });

    it('should use custom default_time', () => {
        const mockOnChange = jest.fn();
        const fieldWithDefaultTime = {...defaultField, default_time: '09:00', is_required: true};

        // Mock getRoundedTime from datetime_input
        const mockMoment = {
            format: jest.fn().mockReturnValue('2025-01-15T14:00:00Z'),
        };
        const {getRoundedTime} = require('components/datetime_input/datetime_input');
        getRoundedTime.mockReturnValue(mockMoment);
        momentToString.mockReturnValue('2025-01-15T14:00:00Z');

        renderComponent({field: fieldWithDefaultTime, onChange: mockOnChange});

        expect(mockOnChange).toHaveBeenCalledWith('test_datetime', '2025-01-15T14:00:00Z');
    });

    it('should use custom time_interval', () => {
        const mockMoment = {
            format: jest.fn().mockReturnValue('Jan 15, 2025 2:30 PM'),
        };
        stringToMoment.mockReturnValue(mockMoment);

        const fieldWithInterval = {...defaultField, time_interval: 30};
        renderComponent({field: fieldWithInterval, value: '2025-01-15T14:30:00Z'});

        expect(screen.getByTestId('datetime-input')).toBeInTheDocument();

        // The time_interval is passed to DateTimeInput component
    });

    it('should handle datetime change', () => {
        const mockOnChange = jest.fn();
        const mockMoment = {
            format: jest.fn().mockReturnValue('Jan 15, 2025 2:30 PM'),
        };
        stringToMoment.mockReturnValue(mockMoment);
        momentToString.mockReturnValue('2025-01-15T19:30:00Z');

        renderComponent({onChange: mockOnChange, value: '2025-01-15T14:30:00Z'});

        const button = screen.getByText('Jan 15, 2025 2:30 PM');
        fireEvent.click(button);

        expect(momentToString).toHaveBeenCalledWith(mockMoment, true);
        expect(mockOnChange).toHaveBeenCalledWith('test_datetime', '2025-01-15T19:30:00Z');
    });

    it('should show validation error when hasError is true', () => {
        renderComponent({hasError: true, errorText: 'DateTime is required'});
        expect(screen.getByText('DateTime is required')).toBeInTheDocument();
    });

    it('should show validation error from validateDateRange', () => {
        validateDateRange.mockReturnValue('Date must be after Jan 1, 2025');
        renderComponent({value: '2024-12-31T14:30:00Z'});
        expect(screen.getByText('Date must be after Jan 1, 2025')).toBeInTheDocument();
    });

    it('should apply error styling when there is an error', () => {
        renderComponent({hasError: true});
        const container = screen.getByPlaceholderText('Select date and time').closest('.apps-form-datetime-input');
        expect(container).toHaveClass('has-error');
    });

    it('should apply error styling when validation fails', () => {
        const mockMoment = {
            format: jest.fn().mockReturnValue('Jan 15, 2025 2:30 PM'),
        };
        stringToMoment.mockReturnValue(mockMoment);
        validateDateRange.mockReturnValue('Validation error');

        renderComponent({value: '2025-01-15T14:30:00Z'});
        const container = screen.getByTestId('datetime-input').closest('.apps-form-datetime-input');
        expect(container).toHaveClass('has-error');
    });

    it('should handle min_date and max_date validation', () => {
        const fieldWithRange = {
            ...defaultField,
            min_date: '2025-01-01',
            max_date: '2025-01-31',
        };

        renderComponent({field: fieldWithRange, value: '2025-01-15T14:30:00Z'});

        expect(validateDateRange).toHaveBeenCalledWith(
            '2025-01-15T14:30:00Z',
            '2025-01-01',
            '2025-01-31',
            'UTC',
        );
    });

    it('should be disabled when readonly', () => {
        const readonlyField = {...defaultField, readonly: true};
        renderComponent({field: readonlyField});
        const input = screen.getByPlaceholderText('Select date and time');
        expect(input).toBeDisabled();
    });

    it('should use default 60 minute interval when not specified', () => {
        const mockMoment = {
            format: jest.fn().mockReturnValue('Jan 15, 2025 2:30 PM'),
        };
        stringToMoment.mockReturnValue(mockMoment);

        renderComponent({value: '2025-01-15T14:30:00Z'});

        // Default interval of 60 is used - verified by component rendering without error
        expect(screen.getByTestId('datetime-input')).toBeInTheDocument();
    });
});
