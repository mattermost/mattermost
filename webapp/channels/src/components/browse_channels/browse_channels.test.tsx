// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import type {ActionResult} from 'mattermost-redux/types/actions';

import type {Props} from 'components/browse_channels/browse_channels';
import BrowseChannels from 'components/browse_channels/browse_channels';

import {renderWithContext, screen, userEvent, waitFor, act} from 'tests/react_testing_utils';
import {getHistory} from 'utils/browser_history';
import {TestHelper} from 'utils/test_helper';

jest.useFakeTimers({legacyFakeTimers: true});

describe('components/BrowseChannels', () => {
    const searchResults = {
        data: [{
            id: 'channel-id-1',
            name: 'channel-name-1',
            team_id: 'team_1',
            display_name: 'Channel 1',
            delete_at: 0,
            type: 'O',
            purpose: '',
        }, {
            id: 'channel-id-2',
            name: 'archived-channel',
            team_id: 'team_1',
            display_name: 'Archived',
            delete_at: 123,
            type: 'O',
            purpose: '',
        }, {
            id: 'channel-id-3',
            name: 'private-channel',
            team_id: 'team_1',
            display_name: 'Private',
            delete_at: 0,
            type: 'P',
            purpose: '',
        }, {
            id: 'channel-id-4',
            name: 'private-channel-not-member',
            team_id: 'team_1',
            display_name: 'Private Not Member',
            delete_at: 0,
            type: 'P',
            purpose: '',
        }],
    };

    const archivedChannel = TestHelper.getChannelMock({
        id: 'channel_id_2',
        team_id: 'team_1',
        display_name: 'channel-2',
        name: 'channel-2',
        header: 'channel-2-header',
        purpose: 'channel-2-purpose',
    });

    const privateChannel = TestHelper.getChannelMock({
        id: 'channel_id_3',
        team_id: 'team_1',
        display_name: 'channel-3',
        name: 'channel-3',
        header: 'channel-3-header',
        purpose: 'channel-3-purpose',
        type: 'P',
    });

    const channelActions = {
        joinChannelAction: (userId: string, teamId: string, channelId: string): Promise<ActionResult> => {
            return new Promise((resolve) => {
                if (channelId !== 'channel-1') {
                    return resolve({
                        error: {
                            message: 'error',
                        },
                    });
                }

                return resolve({data: true});
            });
        },
        searchAllChannels: (term: string): Promise<ActionResult> => {
            return new Promise((resolve) => {
                if (term === 'fail') {
                    return resolve({
                        error: {
                            message: 'error',
                        },
                    });
                }

                return resolve(searchResults);
            });
        },
        getChannels: (): Promise<ActionResult<Channel[], Error>> => {
            return new Promise((resolve) => {
                return resolve({
                    data: [TestHelper.getChannelMock({
                        id: 'channel_id_1',
                        team_id: 'team_1',
                        display_name: 'Default Channel',
                        name: 'default-channel',
                        header: 'Default channel header',
                        purpose: 'Default channel purpose',
                    })],
                });
            });
        },
        getArchivedChannels: (): Promise<ActionResult<Channel[], Error>> => {
            return new Promise((resolve) => {
                return resolve({
                    data: [archivedChannel],
                });
            });
        },
    };

    const defaultChannel = TestHelper.getChannelMock({
        id: 'channel_id_1',
        team_id: 'team_1',
        display_name: 'Default Channel',
        name: 'default-channel',
        header: 'Default channel header',
        purpose: 'Default channel purpose',
    });

    const baseProps: Props = {
        channels: [defaultChannel],
        archivedChannels: [archivedChannel],
        privateChannels: [privateChannel],
        currentUserId: 'user-1',
        teamId: 'team_1',
        teamName: 'team_name',
        channelsRequestStarted: false,
        shouldHideJoinedChannels: false,
        myChannelMemberships: {
            'channel-id-3': TestHelper.getChannelMembershipMock({
                channel_id: 'channel-id-3',
                user_id: 'user-1',
            }),
        },
        actions: {
            getChannels: jest.fn(channelActions.getChannels),
            getArchivedChannels: jest.fn(channelActions.getArchivedChannels),
            joinChannel: jest.fn(channelActions.joinChannelAction),
            searchAllChannels: jest.fn(channelActions.searchAllChannels),
            openModal: jest.fn(),
            closeModal: jest.fn(),
            closeRightHandSide: jest.fn(),
            setGlobalItem: jest.fn(),
            getChannelsMemberCount: jest.fn(),
        },
    };

    // Setup userEvent with fake timers
    const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});

    test('should match snapshot and state', async () => {
        const props = {...baseProps, actions: {...baseProps.actions, getChannels: jest.fn(channelActions.getChannels)}};
        const {baseElement} = renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        expect(baseElement).toMatchSnapshot();

        // on componentDidMount
        expect(props.actions.getChannels).toHaveBeenCalledTimes(1);
        expect(props.actions.getChannels).toHaveBeenCalledWith('team_1', 0, 100);
    });

    test('should call closeModal on Close', async () => {
        const closeModal = jest.fn();
        const props = {...baseProps, actions: {...baseProps.actions, closeModal}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Close the modal by clicking the close button
        await user.click(screen.getByLabelText('Close'));

        // Wait for modal to close and handleExit to be called
        await waitFor(() => {
            expect(closeModal).toHaveBeenCalledTimes(1);
        });
    });

    test('should match state on onChange', async () => {
        const searchAllChannels = jest.fn().mockResolvedValue(searchResults);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Initially, original channels should be shown
        expect(screen.getByText('Default Channel')).toBeInTheDocument();

        // Type in search box
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        // After search, search results should be shown
        await waitFor(() => {
            expect(screen.getByText('Channel 1')).toBeInTheDocument();
        });

        // Clear the search
        await user.clear(searchInput);

        // After clearing, original channels should be shown (onChange resets searchedChannels)
        await waitFor(() => {
            expect(screen.getByText('Default Channel')).toBeInTheDocument();
        });
    });

    test('should call props.getChannels on initial load', async () => {
        const getChannels = jest.fn(channelActions.getChannels);
        const props = {...baseProps, actions: {...baseProps.actions, getChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // getChannels is called on componentDidMount
        expect(getChannels).toHaveBeenCalledTimes(1);
        expect(getChannels).toHaveBeenCalledWith('team_1', 0, 100);
    });

    test('should be on loading state when searching', async () => {
        const searchAllChannels = jest.fn().mockImplementation(() => new Promise(() => {})); // Never resolves
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type in search box to trigger searching state
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'test');

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
        });

        // Should show loading state
        expect(screen.getByText('Loading')).toBeInTheDocument();
    });

    test('should attempt to join the channel and fail', async () => {
        const joinChannel = jest.fn().mockResolvedValue({error: {message: 'error message'}});
        const props = {...baseProps, actions: {...baseProps.actions, joinChannel}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Click join on the first channel
        const joinButtons = screen.getAllByRole('button', {name: /join/i});
        await user.click(joinButtons[0]);

        await waitFor(() => {
            expect(joinChannel).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(screen.getByText('error message')).toBeInTheDocument();
        });
    });

    test('should join the channel', async () => {
        const joinChannel = jest.fn().mockResolvedValue({data: true});
        const props = {...baseProps, actions: {...baseProps.actions, joinChannel}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Click join on the first channel
        const joinButtons = screen.getAllByRole('button', {name: /join/i});
        await user.click(joinButtons[0]);

        await waitFor(() => {
            expect(joinChannel).toHaveBeenCalledTimes(1);
        });

        await waitFor(() => {
            expect(getHistory().push).toHaveBeenCalledTimes(1);
        });
    });

    test('should not perform a search if term is empty', async () => {
        const searchAllChannels = jest.fn().mockResolvedValue(searchResults);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type in search box
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'test');

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        // searchAllChannels should be called once for 'test'
        expect(searchAllChannels).toHaveBeenCalledTimes(1);

        // Clear the search
        await user.clear(searchInput);

        // Run timers
        await act(async () => {
            jest.runOnlyPendingTimers();
        });

        // searchAllChannels should still be called only once (empty string doesn't trigger search)
        expect(searchAllChannels).toHaveBeenCalledTimes(1);
    });

    test('should handle a failed search', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Initially, original channels are shown
        expect(screen.getByText('Default Channel')).toBeInTheDocument();

        // Type 'fail' to trigger failed search (API returns error)
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'fail');

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        expect(searchAllChannels).toHaveBeenCalledWith('fail', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});

        // After failed search, no results message should be shown
        await waitFor(() => {
            expect(screen.getByText(/Try searching different keywords/)).toBeInTheDocument();
        });
    });

    test('should perform search and set the correct state', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type search term
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        expect(setTimeout).toHaveBeenCalled();

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        expect(searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});

        // Should show search results
        await waitFor(() => {
            expect(screen.getByText('Channel 1')).toBeInTheDocument();
        });
    });

    test('should perform search on archived channels and set the correct state', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Open the filter dropdown and click on Archived
        await user.click(screen.getByLabelText('Channel type filter'));
        await user.click(await screen.findByText('Archived channels'));

        // Wait for filter to be applied (archivedChannels should now be shown)
        await waitFor(() => {
            expect(screen.getByText('channel-2')).toBeInTheDocument();
        });

        // Type search term
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        expect(searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});

        // Should show only archived channel in results
        await waitFor(() => {
            expect(screen.getByText('Archived')).toBeInTheDocument();
        });

        // Non-archived public channel should not be shown
        expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
    });

    test('should perform search on private channels and set the correct state', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type search term first (to match original test flow)
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        // Wait for React to process state updates from typing
        await act(async () => {
            await Promise.resolve();
        });

        // Now open the filter dropdown and click on Private
        // This will trigger changeFilter which calls search(searchTerm) again
        await user.click(screen.getByLabelText('Channel type filter'));
        await user.click(await screen.findByText('Private channels'));

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        expect(searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});

        // Should show only private channel that user is a member of
        // and public/non-member channels should be filtered out
        await waitFor(() => {
            expect(screen.getByText('Private')).toBeInTheDocument();
            expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
            expect(screen.queryByText('Private Not Member')).not.toBeInTheDocument();
        });
    });

    test('should perform search on public channels and set the correct state', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type search term first (to match original test flow)
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        // Wait for React to process state updates from typing
        await act(async () => {
            await Promise.resolve();
        });

        // Now open the filter dropdown and click on Public
        // This will trigger changeFilter which calls search(searchTerm) again
        await user.click(screen.getByLabelText('Channel type filter'));
        await user.click(await screen.findByText('Public channels'));

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        expect(searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});

        // Should show only public non-archived channel in results
        // and archived/private channels should be filtered out
        await waitFor(() => {
            expect(screen.getByText('Channel 1')).toBeInTheDocument();
            expect(screen.queryByText('Archived')).not.toBeInTheDocument();
            expect(screen.queryByText('Private')).not.toBeInTheDocument();
        });
    });

    test('should perform search on all channels and set the correct state when shouldHideJoinedChannels is true', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {
            ...baseProps,
            shouldHideJoinedChannels: true,
            actions: {...baseProps.actions, searchAllChannels},
        };
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type search term
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        expect(searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});

        // With shouldHideJoinedChannels: true, channels user has joined should be hidden
        // User is a member of 'channel-id-3' (Private), so it should not appear
        await waitFor(() => {
            expect(screen.getByText('Channel 1')).toBeInTheDocument();
            expect(screen.queryByText('Private')).not.toBeInTheDocument();
        });
    });

    test('should perform search on all channels and set the correct state when shouldHideJoinedChannels is true and filter is private', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {
            ...baseProps,
            shouldHideJoinedChannels: true,
            actions: {...baseProps.actions, searchAllChannels},
        };
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type search term first
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        // Wait for React to process state updates from typing
        await act(async () => {
            await Promise.resolve();
        });

        // Open the filter dropdown and click on Private
        await user.click(screen.getByLabelText('Channel type filter'));
        await user.click(await screen.findByText('Private channels'));

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        expect(searchAllChannels).toHaveBeenCalledWith('channel', {include_deleted: true, nonAdminSearch: true, team_ids: ['team_1']});

        // With Private filter + shouldHideJoinedChannels:
        // - Private filter shows only private channels user is a member of (channel-id-3)
        // - shouldHideJoinedChannels removes channels user has joined (channel-id-3)
        // Result: No channels should be shown
        await waitFor(() => {
            expect(screen.queryByText('Private')).not.toBeInTheDocument();
            expect(screen.queryByText('Channel 1')).not.toBeInTheDocument();
        });
    });

    it('should perform search on all channels and should not show private channels that user is not a member of', async () => {
        const searchAllChannels = jest.fn(channelActions.searchAllChannels);
        const props = {...baseProps, actions: {...baseProps.actions, searchAllChannels}};
        renderWithContext(<BrowseChannels {...props}/>);

        // Wait for component to load
        await act(async () => {
            await Promise.resolve();
        });

        // Type search term
        const searchInput = screen.getByPlaceholderText('Search channels');
        await user.type(searchInput, 'channel');

        // Run timers for search debounce
        await act(async () => {
            jest.runOnlyPendingTimers();
            await Promise.resolve();
        });

        // With default "All channels" filter:
        // - Public channels are shown
        // - Private channels user IS a member of are shown
        // - Private channels user is NOT a member of are hidden
        await waitFor(() => {
            expect(screen.getByText('Channel 1')).toBeInTheDocument();
            expect(screen.getByText('Private')).toBeInTheDocument();
            expect(screen.queryByText('Private Not Member')).not.toBeInTheDocument();
        });
    });
});
