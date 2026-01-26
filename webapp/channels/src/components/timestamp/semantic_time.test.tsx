// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {render, screen} from 'tests/react_testing_utils';

import SemanticTime from './semantic_time';

describe('components/timestamp/SemanticTime', () => {
    test('should render time semantically', () => {
        render(
            <SemanticTime
                value={new Date('2020-06-05T10:20:30Z')}
            />,
        );
        expect(screen.getByRole('time')).toHaveAttribute('datetime', '2020-06-05T10:20:30.000');
    });

    test('should support passthrough children', () => {
        render(
            <SemanticTime
                value={new Date('2020-06-05T10:20:30Z')}
            >
                {'10:20'}
            </SemanticTime>,
        );

        expect(screen.getByRole('time')).toHaveTextContent('10:20');
    });

    test('should support custom label', () => {
        const {container} = render(
            <SemanticTime
                value={new Date('2020-06-05T10:20:30Z')}
                aria-label='A custom label'
            />,
        );

        expect(container).toMatchSnapshot();
    });
});
