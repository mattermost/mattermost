// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {renderWithContext, screen} from 'tests/react_testing_utils';

import EmojiPage from './emoji_page';

jest.mock('utils/utils', () => ({
    localizeMessage: jest.fn().mockReturnValue('Custom Emoji'),
}));

jest.mock('./emoji_list', () => ({
    __esModule: true,
    default: () => <div data-testid='emoji-list'/>,
}));

jest.mock('components/permissions_gates/any_team_permission_gate', () => ({
    __esModule: true,
    default: ({children}: {children: React.ReactNode}) => <div data-testid='permission-gate'>{children}</div>,
}));

describe('EmojiPage', () => {
    const mockLoadRolesIfNeeded = jest.fn();
    const mockScrollToTop = jest.fn();

    const defaultProps = {
        teamName: 'team',
        teamDisplayName: 'Team Display Name',
        siteName: 'Site Name',
        scrollToTop: mockScrollToTop,
        actions: {
            loadRolesIfNeeded: mockLoadRolesIfNeeded,
        },
    };

    it('should render without crashing', () => {
        const {container} = renderWithContext(<EmojiPage {...defaultProps}/>);
        expect(container).toMatchSnapshot();
    });

    it('should render the emoji list and the add button with permission', () => {
        renderWithContext(<EmojiPage {...defaultProps}/>);
        expect(screen.getByTestId('emoji-list')).toBeInTheDocument();
        expect(screen.getByTestId('permission-gate')).toBeInTheDocument();
        expect(screen.getByRole('link')).toHaveAttribute('href', '/team/emoji/add');
    });

    it('should not render the add button if permission is not granted', () => {
        renderWithContext(
            <EmojiPage
                {...defaultProps}
                teamName=''
                actions={{loadRolesIfNeeded: mockLoadRolesIfNeeded}}
            />,
        );
        expect(screen.getByTestId('permission-gate')).toBeInTheDocument();
        expect(screen.getByRole('link')).toBeInTheDocument();
    });

    it('should render EmojiList component', () => {
        renderWithContext(<EmojiPage {...defaultProps}/>);
        expect(screen.getByTestId('emoji-list')).toBeInTheDocument();
    });
});
