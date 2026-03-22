// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen, fireEvent} from 'tests/react_testing_utils';

import * as Actions from './actions';
import {InlineEntityTypes} from './constants';

import InlineEntityLink from './index';

// Mock the actions
jest.mock('./actions', () => ({
    handleInlineEntityClick: jest.fn(() => ({type: 'MOCK_ACTION'})),
}));

describe('InlineEntityLink', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const baseProps = {
        url: 'http://localhost:8065/team-name/pl/postid123?view=citation',
        text: 'Link Text',
        className: 'custom-class',
    };

    test('should render as a normal link if parsing fails', () => {
        const props = {
            ...baseProps,
            url: 'http://invalid-url.com',
        };

        renderWithContext(<InlineEntityLink {...props}/>);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', props.url);
        expect(link).toHaveClass('custom-class');
        expect(link).toHaveTextContent('Link Text');
        expect(screen.queryByTestId('linkVariantIcon')).not.toBeInTheDocument();
    });

    test('should render as a Post link correctly', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name/pl/postid123?view=citation',
        };

        renderWithContext(<InlineEntityLink {...props}/>);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', props.url);
        expect(link).toHaveClass('inline-entity-link');
        expect(link).toHaveClass('custom-class');
        expect(link).toHaveAttribute('aria-label', 'Go to post');
    });

    test('should render as a Channel link correctly', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name/channels/channel-name?view=citation',
        };

        renderWithContext(<InlineEntityLink {...props}/>);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', props.url);
        expect(link).toHaveClass('inline-entity-link');
        expect(link).toHaveAttribute('aria-label', 'Go to channel');
    });

    test('should render as a Team link correctly', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name?view=citation',
        };

        renderWithContext(<InlineEntityLink {...props}/>);

        const link = screen.getByRole('link');
        expect(link).toHaveAttribute('href', props.url);
        expect(link).toHaveClass('inline-entity-link');
        expect(link).toHaveAttribute('aria-label', 'Go to team');
    });

    test('should handle click event and dispatch action for Post', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name/pl/postid123?view=citation',
        };

        renderWithContext(<InlineEntityLink {...props}/>);
        const link = screen.getByRole('link');

        fireEvent.click(link);

        expect(Actions.handleInlineEntityClick).toHaveBeenCalledWith(
            InlineEntityTypes.POST,
            'postid123',
            'team-name',
            '',
        );
    });

    test('should handle click event and dispatch action for Channel', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name/channels/channel-name?view=citation',
        };

        renderWithContext(<InlineEntityLink {...props}/>);
        const link = screen.getByRole('link');

        fireEvent.click(link);

        expect(Actions.handleInlineEntityClick).toHaveBeenCalledWith(
            InlineEntityTypes.CHANNEL,
            '',
            'team-name',
            'channel-name',
        );
    });

    test('should handle click event and dispatch action for Team', () => {
        const props = {
            ...baseProps,
            url: 'http://localhost:8065/team-name?view=citation',
        };

        renderWithContext(<InlineEntityLink {...props}/>);
        const link = screen.getByRole('link');

        fireEvent.click(link);

        expect(Actions.handleInlineEntityClick).toHaveBeenCalledWith(
            InlineEntityTypes.TEAM,
            '',
            'team-name',
            '',
        );
    });
});
