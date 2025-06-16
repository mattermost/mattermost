// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen, fireEvent} from '@testing-library/react';

import {renderWithContext} from 'tests/react_testing_utils';

import {ReasonOption} from './reason_option';

describe('ReasonOption', () => {
    const mockProps = {
        data: {label: 'Test Reason', value: 'test_reason'},
        innerProps: {},
        selectProps: {},
        removeProps: {
            onClick: jest.fn(),
        },
        children: null,
        className: '',
        cx: jest.fn(),
        getStyles: jest.fn(),
        getValue: jest.fn(),
        hasValue: false,
        isMulti: true,
        isRtl: false,
        options: [],
        selectOption: jest.fn(),
        setValue: jest.fn(),
        clearValue: jest.fn(),
        theme: {} as any,
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render the reason option with correct label', () => {
        renderWithContext(<ReasonOption {...mockProps} />);
        
        expect(screen.getByText('Test Reason')).toBeInTheDocument();
    });

    test('should render with ReasonOption class', () => {
        const {container} = renderWithContext(<ReasonOption {...mockProps} />);
        
        expect(container.querySelector('.ReasonOption')).toBeInTheDocument();
    });

    test('should render remove button with close icon', () => {
        renderWithContext(<ReasonOption {...mockProps} />);
        
        const removeButton = container.querySelector('.Remove');
        expect(removeButton).toBeInTheDocument();
    });

    test('should call onClick when remove button is clicked', () => {
        const {container} = renderWithContext(<ReasonOption {...mockProps} />);
        
        const removeButton = container.querySelector('.Remove');
        fireEvent.click(removeButton!);
        
        expect(mockProps.removeProps.onClick).toHaveBeenCalledTimes(1);
    });

    test('should render with different label', () => {
        const propsWithDifferentLabel = {
            ...mockProps,
            data: {label: 'Another Reason', value: 'another_reason'},
        };
        
        renderWithContext(<ReasonOption {...propsWithDifferentLabel} />);
        
        expect(screen.getByText('Another Reason')).toBeInTheDocument();
        expect(screen.queryByText('Test Reason')).not.toBeInTheDocument();
    });

    test('should pass through innerProps to the main container', () => {
        const customInnerProps = {
            'data-testid': 'custom-reason-option',
            className: 'custom-class',
        };
        
        const propsWithCustomInnerProps = {
            ...mockProps,
            innerProps: customInnerProps,
        };
        
        renderWithContext(<ReasonOption {...propsWithCustomInnerProps} />);
        
        expect(screen.getByTestId('custom-reason-option')).toBeInTheDocument();
    });

    test('should render custom children in remove button when provided', () => {
        const customChildren = <span>Custom Remove</span>;
        const mockRemoveProps = {
            ...mockProps.removeProps,
            children: customChildren,
        };
        
        const propsWithCustomChildren = {
            ...mockProps,
            removeProps: mockRemoveProps,
        };
        
        renderWithContext(<ReasonOption {...propsWithCustomChildren} />);
        
        expect(screen.getByText('Custom Remove')).toBeInTheDocument();
    });

    test('should handle empty label gracefully', () => {
        const propsWithEmptyLabel = {
            ...mockProps,
            data: {label: '', value: 'empty_reason'},
        };
        
        const {container} = renderWithContext(<ReasonOption {...propsWithEmptyLabel} />);
        
        expect(container.querySelector('.ReasonOption')).toBeInTheDocument();
    });
});
