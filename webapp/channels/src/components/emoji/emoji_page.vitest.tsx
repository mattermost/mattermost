// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {MemoryRouter} from 'react-router-dom';

import type {Theme} from 'mattermost-redux/selectors/entities/preferences';

import {renderWithContext, screen, waitFor} from 'tests/vitest_react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import EmojiPage from './emoji_page';

vi.mock('utils/utils', () => ({
    localizeMessage: vi.fn().mockReturnValue('Custom Emoji'),
    resetTheme: vi.fn(),
    applyTheme: vi.fn(),
}));

describe('EmojiPage', () => {
    const mockLoadRolesIfNeeded = vi.fn();
    const mockScrollToTop = vi.fn();
    const mockCurrentTheme = {} as Theme;

    const defaultProps = {
        teamName: 'team',
        teamDisplayName: 'Team Display Name',
        siteName: 'Site Name',
        scrollToTop: mockScrollToTop,
        currentTheme: mockCurrentTheme,
        actions: {
            loadRolesIfNeeded: mockLoadRolesIfNeeded,
        },
    };

    // State with permissions to create emojis
    const stateWithPermissions = {
        entities: {
            users: {
                currentUserId: 'current-user-id',
                profiles: {
                    'current-user-id': TestHelper.getUserMock({id: 'current-user-id'}),
                },
            },
            teams: {
                currentTeamId: 'team-id',
                teams: {
                    'team-id': TestHelper.getTeamMock({id: 'team-id', name: 'team'}),
                },
                myMembers: {
                    'team-id': {
                        team_id: 'team-id',
                        user_id: 'current-user-id',
                        roles: 'team_user',
                    },
                },
            },
            roles: {
                roles: {
                    team_user: {
                        permissions: ['create_emojis'],
                    },
                },
            },
        },
    };

    // Wrapper to provide router context for Link components
    const renderWithRouter = (props = defaultProps, state = stateWithPermissions) => {
        return renderWithContext(
            <MemoryRouter>
                <EmojiPage {...props}/>
            </MemoryRouter>,
            state,
        );
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without crashing', async () => {
        const {container} = renderWithRouter();
        await waitFor(() => {
            expect(container).toBeInTheDocument();
        });
        expect(container).toMatchSnapshot();
    });

    it('should render the emoji list and the add button with permission', async () => {
        renderWithRouter();

        await waitFor(() => {
            // Verify the header is rendered
            expect(screen.getByRole('heading', {name: /custom emoji/i})).toBeInTheDocument();
        });

        // Verify the Add button is rendered
        expect(screen.getByRole('button', {name: /add custom emoji/i})).toBeInTheDocument();

        // Verify the link to add emoji page
        const addLink = screen.getByRole('link', {name: /add custom emoji/i});
        expect(addLink).toHaveAttribute('href', '/team/emoji/add');

        // Verify the emoji list container exists
        expect(document.querySelector('.emoji-list')).toBeInTheDocument();
    });

    it('should not render the add button if permission is not granted', async () => {
        // State without permissions
        const stateWithoutPermissions = {
            entities: {
                users: {
                    currentUserId: 'current-user-id',
                    profiles: {
                        'current-user-id': TestHelper.getUserMock({id: 'current-user-id'}),
                    },
                },
                teams: {
                    currentTeamId: 'team-id',
                    teams: {
                        'team-id': TestHelper.getTeamMock({id: 'team-id', name: 'team'}),
                    },
                    myMembers: {
                        'team-id': {
                            team_id: 'team-id',
                            user_id: 'current-user-id',
                            roles: 'team_user',
                        },
                    },
                },
                roles: {
                    roles: {
                        team_user: {
                            permissions: [], // No create_emojis permission
                        },
                    },
                },
            },
        };

        renderWithRouter(defaultProps, stateWithoutPermissions);

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: /custom emoji/i})).toBeInTheDocument();
        });

        // Add button should not be rendered without permission
        expect(screen.queryByRole('button', {name: /add custom emoji/i})).not.toBeInTheDocument();
    });

    it('should render EmojiList component', async () => {
        renderWithRouter();

        await waitFor(() => {
            expect(screen.getByRole('heading', {name: /custom emoji/i})).toBeInTheDocument();
        });

        // EmojiList renders a search input with placeholder "Search Custom Emoji"
        expect(screen.getByPlaceholderText(/search custom emoji/i)).toBeInTheDocument();
    });
});
