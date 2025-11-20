// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {screen} from '@testing-library/react';

import ActiveEditorsIndicator from 'components/active_editors_indicator/active_editors_indicator';

import {renderWithContext} from 'tests/react_testing_utils';

jest.mock('hooks/useActiveEditors', () => ({
    useActiveEditors: jest.fn(),
}));

jest.mock('components/widgets/users/avatar', () => {
    return jest.fn().mockImplementation((props) => {
        const testId = props['data-testid'];
        return <div data-testid={testId}>{props.username}</div>;
    });
});

import {useActiveEditors} from 'hooks/useActiveEditors';

describe('components/ActiveEditorsIndicator', () => {
    const baseProps = {
        wikiId: 'wiki123',
        pageId: 'page123',
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should render nothing when no editors', () => {
        (useActiveEditors as jest.Mock).mockReturnValue([]);

        const {container} = renderWithContext(<ActiveEditorsIndicator {...baseProps}/>);

        expect(container.firstChild).toBeNull();
    });

    test('should render single editor with avatar and text', () => {
        const editors = [
            {
                userId: 'user1',
                lastActivity: Date.now(),
                user: {
                    id: 'user1',
                    username: 'john.doe',
                },
            },
        ];
        (useActiveEditors as jest.Mock).mockReturnValue(editors);

        renderWithContext(<ActiveEditorsIndicator {...baseProps}/>);

        expect(screen.getByTestId('active-editor-avatar-user1')).toBeInTheDocument();
        expect(screen.getByText(/1 person editing/i)).toBeInTheDocument();
    });

    test('should render multiple editors with avatars', () => {
        const editors = [
            {
                userId: 'user1',
                lastActivity: Date.now(),
                user: {
                    id: 'user1',
                    username: 'john.doe',
                },
            },
            {
                userId: 'user2',
                lastActivity: Date.now(),
                user: {
                    id: 'user2',
                    username: 'jane.smith',
                },
            },
        ];
        (useActiveEditors as jest.Mock).mockReturnValue(editors);

        renderWithContext(<ActiveEditorsIndicator {...baseProps}/>);

        expect(screen.getByTestId('active-editor-avatar-user1')).toBeInTheDocument();
        expect(screen.getByTestId('active-editor-avatar-user2')).toBeInTheDocument();
        expect(screen.getByText(/2 people editing/i)).toBeInTheDocument();
    });

    test('should display only first 3 avatars and show +N for remaining', () => {
        const editors = [
            {userId: 'user1', lastActivity: Date.now(), user: {id: 'user1', username: 'user1'}},
            {userId: 'user2', lastActivity: Date.now(), user: {id: 'user2', username: 'user2'}},
            {userId: 'user3', lastActivity: Date.now(), user: {id: 'user3', username: 'user3'}},
            {userId: 'user4', lastActivity: Date.now(), user: {id: 'user4', username: 'user4'}},
            {userId: 'user5', lastActivity: Date.now(), user: {id: 'user5', username: 'user5'}},
        ];
        (useActiveEditors as jest.Mock).mockReturnValue(editors);

        renderWithContext(<ActiveEditorsIndicator {...baseProps}/>);

        expect(screen.getByTestId('active-editor-avatar-user1')).toBeInTheDocument();
        expect(screen.getByTestId('active-editor-avatar-user2')).toBeInTheDocument();
        expect(screen.getByTestId('active-editor-avatar-user3')).toBeInTheDocument();
        expect(screen.queryByTestId('active-editor-avatar-user4')).not.toBeInTheDocument();
        expect(screen.queryByTestId('active-editor-avatar-user5')).not.toBeInTheDocument();

        expect(screen.getByText('+2')).toBeInTheDocument();
        expect(screen.getByText(/5 people editing/i)).toBeInTheDocument();
    });

    test('should show correct plural form for single editor', () => {
        const editors = [
            {
                userId: 'user1',
                lastActivity: Date.now(),
                user: {
                    id: 'user1',
                    username: 'john.doe',
                },
            },
        ];
        (useActiveEditors as jest.Mock).mockReturnValue(editors);

        renderWithContext(<ActiveEditorsIndicator {...baseProps}/>);

        expect(screen.getByText(/1 person editing/i)).toBeInTheDocument();
        expect(screen.queryByText(/people/i)).not.toBeInTheDocument();
    });

    test('should call useActiveEditors with correct props', () => {
        (useActiveEditors as jest.Mock).mockReturnValue([]);

        renderWithContext(<ActiveEditorsIndicator {...baseProps}/>);

        expect(useActiveEditors).toHaveBeenCalledWith('wiki123', 'page123');
    });
});
