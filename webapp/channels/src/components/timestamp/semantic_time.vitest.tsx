// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import SemanticTime from './semantic_time';

describe('components/timestamp/SemanticTime', () => {
    test('should render time semantically', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        const {container} = renderWithContext(
            <SemanticTime
                value={date}
            />,
        );
        const timeElement = container.querySelector('time');
        expect(timeElement).toHaveAttribute('dateTime', '2020-06-05T10:20:30.000');
    });

    test('should support passthrough children', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        renderWithContext(
            <SemanticTime
                value={date}
            >
                {'10:20'}
            </SemanticTime>,
        );

        expect(screen.getByText('10:20')).toBeInTheDocument();
    });

    test('should support custom label', () => {
        const date = new Date('2020-06-05T10:20:30Z');
        const {container} = renderWithContext(
            <SemanticTime
                value={date}
                aria-label='A custom label'
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
