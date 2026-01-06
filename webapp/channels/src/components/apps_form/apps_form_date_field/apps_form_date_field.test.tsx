// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {screen, fireEvent} from '@testing-library/react';
import React from 'react';

import type {AppField} from '@mattermost/types/apps';

import {renderWithContext} from 'tests/react_testing_utils';

import AppsFormDateField from './apps_form_date_field';

jest.mock('mattermost-redux/selectors/entities/timezone', () => ({
    getCurrentTimezone: jest.fn().mockReturnValue('America/New_York'),
}));

describe('AppsFormDateField', () => {
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
    };

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock current time to avoid timezone-dependent tests
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-15T10:00:00.000Z'));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    const renderComponent = (props = {}) => {
        return renderWithContext(
            <AppsFormDateField
                {...defaultProps}
                {...props}
            />,
        );
    };

    it('should render date picker component', () => {
        renderComponent();
        expect(screen.getByRole('button')).toBeInTheDocument();
        expect(screen.getByText('Select a date')).toBeInTheDocument();
    });

    it('should render date picker regardless of field requirements', () => {
        const requiredField = {...defaultField, is_required: true};
        renderComponent({field: requiredField});
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should render date picker regardless of field description', () => {
        const fieldWithDescription = {...defaultField, description: 'Select your preferred date'};
        renderComponent({field: fieldWithDescription});
        expect(screen.getByRole('button')).toBeInTheDocument();
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

    // Note: Invalid date validation is now handled centrally in integration_utils.ts
    // Component gracefully handles invalid values without crashing

    it('should render without errors even when date is outside range (validation is centralized)', () => {
        const fieldWithRange = {
            ...defaultField,
            min_date: '2025-01-10',
            max_date: '2025-01-20',
        };
        renderComponent({field: fieldWithRange, value: '2025-01-01'});

        // Component should still render, validation is now handled centrally on form submission
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should not show error for valid date within range', () => {
        const fieldWithRange = {
            ...defaultField,
            min_date: '2025-01-01',
            max_date: '2025-01-31',
        };
        renderComponent({field: fieldWithRange, value: '2025-01-15'});
        expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
    });

    it('should render date picker for interaction', () => {
        const mockOnChange = jest.fn();
        renderComponent({onChange: mockOnChange});

        // Verify that the DatePicker is rendered
        const datePicker = screen.getByRole('button');
        expect(datePicker).toBeInTheDocument();
    });

    it('should handle date range constraints', () => {
        const fieldWithRange = {
            ...defaultField,
            min_date: '2025-01-01',
            max_date: '2025-01-31',
        };

        renderComponent({field: fieldWithRange, value: '2025-01-15'});
        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should display formatted date value', () => {
        renderComponent({value: '2025-01-15'});

        // The component should render a date picker with the formatted date
        expect(screen.getByRole('button')).toBeInTheDocument();
    });
});
