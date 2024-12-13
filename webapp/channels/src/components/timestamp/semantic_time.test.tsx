// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import SemanticTime from './semantic_time';

describe('components/timestamp/SemanticTime', () => {
    test('should render time semantically', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        render(
            <SemanticTime
                value={date}
            />,
        );
        
        const timeElement = screen.getByTestId('semantic-time');
        expect(timeElement).toHaveAttribute('datetime', '2020-06-05T10:20:30.000');
    });

    test('should support passthrough children', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        render(
            <SemanticTime
                value={date}
            >
                {'10:20'}
            </SemanticTime>,
        );

        const timeElement = screen.getByText('10:20');
        expect(timeElement).toBeInTheDocument();
        expect(timeElement.tagName).toBe('TIME');
    });

    test('should support custom label', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        render(
            <SemanticTime
                value={date}
                aria-label='A custom label'
            />,
        );

        const timeElement = screen.getByLabelText('A custom label');
        expect(timeElement).toBeInTheDocument();
        expect(timeElement.tagName).toBe('TIME');
        expect(timeElement).toHaveAttribute('datetime', '2020-06-05T10:20:30.000');
    });
});
