// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import TimestampPropertyRenderer from './timestamp_property_renderer';

describe('TimestampPropertyRenderer', () => {
    const mockValue = {
        value: 1642694400000, // January 20, 2022 12:00:00 PM UTC
    };

    it('should render timestamp property with correct test id', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue} />,
        );

        expect(screen.getByTestId('timestamp-property')).toBeVisible();
    });

    it('should render timestamp component with the provided value', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue} />,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        
        // The Timestamp component should be rendered inside
        const timestampContent = timestampElement.querySelector('time');
        expect(timestampContent).toBeVisible();
        
        // Check that the timestamp displays the expected date format
        expect(timestampElement).toHaveTextContent('Thursday, 20 January 2022');
        expect(timestampElement).toHaveTextContent('12:00:00');
    });

    it('should handle zero timestamp value', () => {
        const zeroValue = {
            value: 0,
        };

        renderWithContext(
            <TimestampPropertyRenderer value={zeroValue} />,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        
        // Check that epoch time (0) renders correctly
        expect(timestampElement).toHaveTextContent('Thursday, 1 January 1970');
        expect(timestampElement).toHaveTextContent('00:00:00');
    });

    it('should handle negative timestamp value', () => {
        const negativeValue = {
            value: -86400000, // One day before epoch
        };

        renderWithContext(
            <TimestampPropertyRenderer value={negativeValue} />,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        
        // Check that negative timestamp (one day before epoch) renders correctly
        expect(timestampElement).toHaveTextContent('Wednesday, 31 December 1969');
        expect(timestampElement).toHaveTextContent('00:00:00');
    });

    it('should handle future timestamp value', () => {
        const futureValue = {
            value: 2000000000000, // May 18, 2033
        };

        renderWithContext(
            <TimestampPropertyRenderer value={futureValue} />,
        );

        const timestampElement = screen.getByTestId('timestamp-property');
        expect(timestampElement).toBeVisible();
        
        // Check that future timestamp renders correctly
        expect(timestampElement).toHaveTextContent('Wednesday, 18 May 2033');
        expect(timestampElement).toHaveTextContent('03:33:20');
    });

    it('should apply correct CSS class', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue} />,
        );

        const element = screen.getByTestId('timestamp-property');
        expect(element).toHaveClass('TimestampPropertyRenderer');
    });

    it('should render as a div element', () => {
        renderWithContext(
            <TimestampPropertyRenderer value={mockValue} />,
        );

        const element = screen.getByTestId('timestamp-property');
        expect(element.tagName).toBe('DIV');
    });
});
