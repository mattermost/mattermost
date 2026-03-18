// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import RecapTextFormatter from './recap_text_formatter';

jest.mock('components/markdown', () => {
    return function Markdown({message}: {message: string}) {
        return <div data-testid='markdown'>{message}</div>;
    };
});

describe('RecapTextFormatter', () => {
    const baseState = {
        entities: {
            channels: {
                channels: {},
                channelsInTeam: {},
                myMembers: {},
            },
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: TestHelper.getTeamMock({
                        id: 'team1',
                        name: 'test-team',
                        display_name: 'Test Team',
                    }),
                },
            },
        },
    };

    test('should render text content', () => {
        const text = 'This is a recap message';
        renderWithContext(
            <RecapTextFormatter text={text}/>,
            baseState,
        );

        expect(screen.getByTestId('markdown')).toHaveTextContent(text);
    });

    test('should strip HTML tags from text', () => {
        const text = 'This is <strong>bold</strong> text';
        renderWithContext(
            <RecapTextFormatter text={text}/>,
            baseState,
        );

        expect(screen.getByTestId('markdown')).toHaveTextContent('This is bold text');
    });

    test('should apply custom className when provided', () => {
        const text = 'Test message';
        const className = 'custom-class';
        const {container} = renderWithContext(
            <RecapTextFormatter
                text={text}
                className={className}
            />,
            baseState,
        );

        expect(container.querySelector(`.${className}`)).toBeInTheDocument();
    });

    test('should handle text with multiple HTML tags', () => {
        const text = '<div><p>Nested <span>HTML</span> tags</p></div>';
        renderWithContext(
            <RecapTextFormatter text={text}/>,
            baseState,
        );

        expect(screen.getByTestId('markdown')).toHaveTextContent('Nested HTML tags');
    });

    test('should handle empty text', () => {
        renderWithContext(
            <RecapTextFormatter text=''/>,
            baseState,
        );

        expect(screen.getByTestId('markdown')).toBeInTheDocument();
    });

    test('should render with default props when className not provided', () => {
        const text = 'Default styling test';
        const {container} = renderWithContext(
            <RecapTextFormatter text={text}/>,
            baseState,
        );

        // Should render a div wrapper
        expect(container.querySelector('div')).toBeInTheDocument();
    });
});

