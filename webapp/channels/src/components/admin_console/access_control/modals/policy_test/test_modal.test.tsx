// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserProfile} from '@mattermost/types/users';

import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import TestResultsModal from './test_modal';

// Mock the channel-picker step so the modal's step logic can be tested in
// isolation (the picker's own search/rendering is covered by its own test).
jest.mock('./test_channel_picker', () => {
    return function MockTestChannelPicker({onSelect}: {onSelect: (channelId: string) => void}) {
        return (
            <button
                data-testid='mock-pick-channel'
                onClick={() => onSelect('picked-channel')}
            >
                {'Pick channel'}
            </button>
        );
    };
});

// Mock the SearchableUserList component
jest.mock('components/searchable_user_list/searchable_user_list_container', () => {
    return function MockSearchableUserList({
        users,
        usersPerPage,
        total,
        nextPage,
        search,
    }: {
        users: UserProfile[];
        usersPerPage: number;
        total: number;
        nextPage: (page: number) => void;
        search: (term: string) => void;
    }) {
        return (
            <div data-testid='searchable-user-list'>
                <input
                    data-testid='search-input'
                    type='text'
                    placeholder='Search users'
                    onChange={(e) => search(e.target.value)}
                />
                <div data-testid='user-count'>
                    {'Showing '}{users.length}{' of '}{total}{' users'}
                </div>
                <div data-testid='users-per-page'>
                    {usersPerPage}{' users per page'}
                </div>
                <div data-testid='users-list'>
                    {users.map((user) => (
                        <div
                            key={user.id}
                            data-testid={`user-${user.id}`}
                        >
                            {user.username}
                        </div>
                    ))}
                </div>
                <button
                    data-testid='next-page-button'
                    onClick={() => nextPage(5)} // Use page 5 to trigger pagination (5 * 10 = 50, which is not < 50)
                >
                    {'Next Page'}
                </button>
            </div>
        );
    };
});

describe('TestResultsModal', () => {
    const mockUsers: UserProfile[] = [
        TestHelper.getUserMock({
            id: 'user1',
            username: 'testuser1',
            email: 'test1@example.com',
        }),
        TestHelper.getUserMock({
            id: 'user2',
            username: 'testuser2',
            email: 'test2@example.com',
        }),
    ];

    const mockSearchUsers = jest.fn();
    const mockOnExited = jest.fn();

    const defaultProps = {
        onExited: mockOnExited,
        actions: {
            searchUsers: mockSearchUsers,
        },
    };

    beforeEach(() => {
        // Mock Redux thunk that returns successful user search response
        mockSearchUsers.mockReturnValue(() => Promise.resolve({
            data: {
                users: mockUsers,
                total: 2,
            },
        }));
    });

    it('should render modal with proper title and structure', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        // Wait for the modal to appear
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Check modal title
        expect(screen.getByText('Access Rule Test Results')).toBeInTheDocument();

        // Check that SearchableUserList is rendered
        expect(screen.getByTestId('searchable-user-list')).toBeInTheDocument();
    });

    it('should fetch users on initial load', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(mockSearchUsers).toHaveBeenCalledWith('', '', 50, undefined);
        });
    });

    it('should display users from search results', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('user-count')).toHaveTextContent('Showing 2 of 2 users');
        });

        // Check that users are displayed
        expect(screen.getByTestId('user-user1')).toBeInTheDocument();
        expect(screen.getByTestId('user-user2')).toBeInTheDocument();
        expect(screen.getByText('testuser1')).toBeInTheDocument();
        expect(screen.getByText('testuser2')).toBeInTheDocument();
    });

    it('should handle search functionality', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('search-input')).toBeInTheDocument();
        });

        // Perform search
        const searchInput = screen.getByTestId('search-input');
        await userEvent.clear(searchInput);
        await userEvent.type(searchInput, 'test search');

        await waitFor(() => {
            expect(mockSearchUsers).toHaveBeenCalledWith('test search', '', 50, undefined);
        });
    });

    it('should handle pagination', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        // Wait for users to be loaded first
        await waitFor(() => {
            expect(screen.getByTestId('user-user2')).toBeInTheDocument();
        });

        // Mock the next page call that will trigger pagination
        mockSearchUsers.mockReturnValue(() => Promise.resolve({
            data: {
                users: [],
                total: 2,
            },
        }));

        // Click next page - this should trigger pagination with page=2 which translates to 20 users per page
        const nextPageButton = screen.getByTestId('next-page-button');
        await userEvent.click(nextPageButton);

        // The nextPage function gets called with page 1 (second page), but since it's above USERS_PER_PAGE (10)
        // but less than USERS_TO_FETCH (50), it should use the cursor logic and call with the last user's ID
        await waitFor(() => {
            expect(mockSearchUsers).toHaveBeenLastCalledWith('', 'user2', 50, undefined);
        });
    });

    it('should not paginate when loading', async () => {
        // Clear any previous mock calls
        mockSearchUsers.mockClear();

        // Mock loading state by not resolving the promise immediately
        mockSearchUsers.mockReturnValue(() => new Promise(() => {}));

        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('next-page-button')).toBeInTheDocument();
        });

        // The initial call should have been made
        expect(mockSearchUsers).toHaveBeenCalledTimes(1);

        // Click next page while loading
        const nextPageButton = screen.getByTestId('next-page-button');
        await userEvent.click(nextPageButton);

        // Should not make additional call while loading
        expect(mockSearchUsers).toHaveBeenCalledTimes(1);
    });

    it('should handle empty search results', async () => {
        mockSearchUsers.mockReturnValue(() => Promise.resolve({
            data: {
                users: [],
                total: 0,
            },
        }));

        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('user-count')).toHaveTextContent('Showing 0 of 0 users');
        });
    });

    it('should handle search error gracefully', async () => {
        mockSearchUsers.mockReturnValue(() => Promise.resolve({
            error: 'Search failed',
        }));

        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('user-count')).toHaveTextContent('Showing 0 of 0 users');
        });
    });

    it('should call onExited when modal is closed', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Find and click the close button
        const closeButton = screen.getByLabelText('Close');
        await userEvent.click(closeButton);

        await waitFor(() => {
            expect(mockOnExited).toHaveBeenCalled();
        });
    });

    it('should render with isStacked=true prop', async () => {
        renderWithContext(
            <TestResultsModal
                {...defaultProps}
                isStacked={true}
            />,
        );

        // Wait for modal to render, then check it's there
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        expect(screen.getByText('Access Rule Test Results')).toBeInTheDocument();
    });

    it('should render with isStacked=false prop (default)', async () => {
        renderWithContext(
            <TestResultsModal
                {...defaultProps}
                isStacked={false}
            />,
        );

        // Wait for modal to render, then check it's there
        await waitFor(() => {
            expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        expect(screen.getByText('Access Rule Test Results')).toBeInTheDocument();
    });

    it('should reset search on new search term', async () => {
        // Mock different responses for different searches
        mockSearchUsers.
            mockReturnValueOnce(() => Promise.resolve({
                data: {
                    users: [mockUsers[0]],
                    total: 1,
                },
            })).
            mockReturnValueOnce(() => Promise.resolve({
                data: {
                    users: [mockUsers[1]],
                    total: 1,
                },
            }));

        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('search-input')).toBeInTheDocument();
        });

        // Perform first search
        const searchInput = screen.getByTestId('search-input');
        await userEvent.clear(searchInput);
        await userEvent.type(searchInput, 'search1');

        await waitFor(() => {
            expect(mockSearchUsers).toHaveBeenCalledWith('search1', '', 50, undefined);
        });

        // Perform second search
        await userEvent.clear(searchInput);
        await userEvent.type(searchInput, 'search2');

        await waitFor(() => {
            expect(mockSearchUsers).toHaveBeenCalledWith('search2', '', 50, undefined);
        });
    });

    it('should pass correct props to SearchableUserList', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            expect(screen.getByTestId('users-per-page')).toHaveTextContent('10 users per page');
        });
    });

    it('should have proper accessibility attributes', async () => {
        renderWithContext(<TestResultsModal {...defaultProps}/>);

        await waitFor(() => {
            const dialog = screen.getByRole('dialog');
            expect(dialog).toHaveAttribute('aria-label', 'Access Rule Test Results');
        });
    });

    describe('channel-picker step', () => {
        it('opens the members list directly (no picker) when requireChannel is false', async () => {
            renderWithContext(<TestResultsModal {...defaultProps}/>);

            await waitFor(() => {
                expect(screen.getByTestId('searchable-user-list')).toBeInTheDocument();
            });
            expect(screen.queryByTestId('mock-pick-channel')).not.toBeInTheDocument();
            expect(screen.getByText('Access Rule Test Results')).toBeInTheDocument();
        });

        it('shows the picker step first (no user fetch) when requireChannel is true', async () => {
            renderWithContext(
                <TestResultsModal
                    {...defaultProps}
                    requireChannel={true}
                />,
            );

            await waitFor(() => {
                expect(screen.getByTestId('mock-pick-channel')).toBeInTheDocument();
            });

            // Picker step defers the members fetch until a channel is chosen.
            expect(mockSearchUsers).not.toHaveBeenCalled();
            expect(screen.queryByTestId('searchable-user-list')).not.toBeInTheDocument();
            expect(screen.getByText('Select a channel to test against')).toBeInTheDocument();
        });

        it('threads the picked channel id into the members search', async () => {
            renderWithContext(
                <TestResultsModal
                    {...defaultProps}
                    requireChannel={true}
                />,
            );

            const pick = await screen.findByTestId('mock-pick-channel');
            await userEvent.click(pick);

            await waitFor(() => {
                expect(screen.getByTestId('searchable-user-list')).toBeInTheDocument();
            });
            expect(mockSearchUsers).toHaveBeenCalledWith('', '', 50, 'picked-channel');
        });

        it('shows a back arrow in the members view that returns to the picker', async () => {
            renderWithContext(
                <TestResultsModal
                    {...defaultProps}
                    requireChannel={true}
                />,
            );

            const pick = await screen.findByTestId('mock-pick-channel');
            await userEvent.click(pick);

            const back = await screen.findByLabelText('Back to channel selection');
            await userEvent.click(back);

            await waitFor(() => {
                expect(screen.getByTestId('mock-pick-channel')).toBeInTheDocument();
            });
            expect(screen.queryByTestId('searchable-user-list')).not.toBeInTheDocument();
        });

        it('does not show a back arrow in a members-only modal', async () => {
            renderWithContext(<TestResultsModal {...defaultProps}/>);

            await waitFor(() => {
                expect(screen.getByTestId('searchable-user-list')).toBeInTheDocument();
            });
            expect(screen.queryByLabelText('Back to channel selection')).not.toBeInTheDocument();
        });
    });
});
