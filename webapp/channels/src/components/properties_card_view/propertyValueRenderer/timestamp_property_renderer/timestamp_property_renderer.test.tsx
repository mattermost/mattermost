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
    });

    it('should handle zero timestamp value', () => {
        const zeroValue = {
            value: 0,
        };

        renderWithContext(
            <TimestampPropertyRenderer value={zeroValue} />,
        );

        expect(screen.getByTestId('timestamp-property')).toBeVisible();
    });

    it('should handle negative timestamp value', () => {
        const negativeValue = {
            value: -86400000, // One day before epoch
        };

        renderWithContext(
            <TimestampPropertyRenderer value={negativeValue} />,
        );

        expect(screen.getByTestId('timestamp-property')).toBeVisible();
    });

    it('should handle future timestamp value', () => {
        const futureValue = {
            value: 2000000000000, // May 18, 2033
        };

        renderWithContext(
            <TimestampPropertyRenderer value={futureValue} />,
        );

        expect(screen.getByTestId('timestamp-property')).toBeVisible();
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
