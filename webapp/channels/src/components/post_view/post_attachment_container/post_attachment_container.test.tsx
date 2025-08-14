// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {GlobalState} from '@mattermost/types/store';
import type {DeepPartial} from '@mattermost/types/utilities';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import PostAttachmentContainer from './post_attachment_container';
import type {Props} from './post_attachment_container';

describe('PostAttachmentContainer', () => {
    const mockHistoryPush = jest.fn();

    const baseProps: Props = {
        children: <p>{'some children'}</p>,
        className: 'permalink',
        link: '/test/pl/1',
    };

    const initialState: DeepPartial<GlobalState> = {
        entities: {
            general: {config: {}},
            users: {
                currentUserId: 'user1',
                profiles: {},
            },
            teams: {
                currentTeamId: 'current_team_id',
                teams: {},
            },
            posts: {posts: {}},
            preferences: {myPreferences: {}},
        },
    };

    beforeEach(() => {
        mockHistoryPush.mockClear();

        // Mock useHistory
        jest.doMock('react-router-dom', () => ({
            ...jest.requireActual('react-router-dom'),
            useHistory: () => ({push: mockHistoryPush}),
        }));
    });

    test('should render correctly', () => {
        renderWithContext(
            <PostAttachmentContainer {...baseProps}/>, initialState,
        );

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveClass('attachment attachment--permalink');
        expect(button.children[0]).toHaveClass('attachment__content attachment__content--permalink');

        expect(screen.getByText('some children')).toBeInTheDocument();
    });

    test('should handle clicks on elements with non-string className without throwing error', () => {
        renderWithContext(
            <PostAttachmentContainer {...baseProps}/>, initialState,
        );

        const button = screen.getByRole('button');

        // Create a real DOM element and modify its className to be an object
        const mockElement = document.createElement('div');
        Object.defineProperty(mockElement, 'className', {
            value: {baseVal: 'some-class'},
            writable: false,
        });
        Object.defineProperty(mockElement, 'tagName', {
            value: 'DIV',
            writable: false,
        });

        const mockEvent = {
            target: mockElement,
            stopPropagation: jest.fn(),
        } as any;

        // This should not throw the "className.includes is not a function" error
        expect(() => {
            button.onclick?.(mockEvent);
        }).not.toThrow();
    });

    test('should handle clicks on elements without className property', () => {
        renderWithContext(
            <PostAttachmentContainer {...baseProps}/>, initialState,
        );

        const button = screen.getByRole('button');

        // Create a real DOM element and remove its className
        const mockElement = document.createElement('div');
        delete (mockElement as any).className;
        Object.defineProperty(mockElement, 'tagName', {
            value: 'DIV',
            writable: false,
        });

        const mockEvent = {
            target: mockElement,
            stopPropagation: jest.fn(),
        } as any;

        expect(() => {
            button.onclick?.(mockEvent);
        }).not.toThrow();
    });
});
