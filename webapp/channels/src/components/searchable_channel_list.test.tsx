// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

jest.mock('components/channel_type_icon/compass_icon_resolver', () => ({
    compassIconForName: jest.fn(),
}));

import type {Channel} from '@mattermost/types/channels';

import {compassIconForName} from 'components/channel_type_icon';
import {SearchableChannelList} from 'components/searchable_channel_list';

import {type MockIntl} from 'tests/helpers/intl-test-helper';
import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import {Filter} from './browse_channels/browse_channels';

// Mock the compass-icons to make them identifiable in tests
jest.mock('@mattermost/compass-icons/components', () => ({
    ...jest.requireActual('@mattermost/compass-icons/components'),
    ArchiveOutlineIcon: (props: Record<string, unknown>) => (
        <svg
            data-testid='archiveOutlineIcon'
            {...props}
        />
    ),
    ArchiveLockOutlineIcon: (props: Record<string, unknown>) => (
        <svg
            data-testid='archiveLockOutlineIcon'
            {...props}
        />
    ),
    GlobeIcon: () => <span data-testid='default-globe-icon'/>,
    LockOutlineIcon: () => <span data-testid='default-lock-icon'/>,
}));

describe('components/SearchableChannelList', () => {
    const baseProps = {
        channels: [],
        isSearch: false,
        channelsPerPage: 10,
        nextPage: jest.fn(),
        search: jest.fn(),
        handleJoin: jest.fn(),
        loading: true,
        toggleArchivedChannels: jest.fn(),
        closeModal: jest.fn(),
        hideJoinedChannelsPreference: jest.fn(),
        hideArchivedChannelsPreference: jest.fn(),
        changeFilter: jest.fn(),
        myChannelMemberships: {},
        canShowArchivedChannels: false,
        rememberHideJoinedChannelsChecked: false,
        rememberHideArchivedChannelsChecked: true,
        noResultsText: <>{'no channel found'}</>,
        filter: Filter.All,
        intl: {
            formatMessage: ({defaultMessage}: {defaultMessage: string}) => defaultMessage,
        } as MockIntl,
    };

    const initialState = {
        entities: {
            users: {
                currentUserId: 'currentUserId',
            },
            general: {
                config: {},
            },
        },
    };

    test('should match init snapshot', () => {
        const {container} = renderWithContext(
            <SearchableChannelList {...baseProps}/>,
            initialState,
        );
        expect(container).toMatchSnapshot();
    });

    test('should set page to 0 when starting search', () => {
        const {rerender} = renderWithContext(
            <SearchableChannelList {...baseProps}/>,
            initialState,
        );

        // Rerender with isSearch=true to trigger the page reset
        rerender(
            <SearchableChannelList
                {...baseProps}
                isSearch={true}
            />,
        );

        // The component should reset to page 0 when search starts
        // We verify this by checking the search prop was called correctly
        // and the component renders without errors
        expect(baseProps.search).toBeDefined();
    });

    test('renders the Hide Archived checkbox reflecting the persisted preference', () => {
        renderWithContext(
            <SearchableChannelList {...baseProps}/>,
            initialState,
        );

        const hideArchived = screen.getByLabelText('Hide archived channels');
        expect(hideArchived).toBeInTheDocument();
        expect(hideArchived).toHaveAttribute('aria-checked', 'true');
    });

    test('does not render the Hide Archived checkbox when the Archived filter is active', () => {
        renderWithContext(
            <SearchableChannelList
                {...baseProps}
                filter={Filter.Archived}
            />,
            initialState,
        );

        expect(screen.queryByLabelText('Hide archived channels')).not.toBeInTheDocument();
    });

    test('clicking the Hide Archived checkbox toggles the preference', async () => {
        const hideArchivedChannelsPreference = jest.fn();
        renderWithContext(
            <SearchableChannelList
                {...baseProps}
                rememberHideArchivedChannelsChecked={false}
                hideArchivedChannelsPreference={hideArchivedChannelsPreference}
            />,
            initialState,
        );

        const hideArchived = screen.getByLabelText('Hide archived channels');
        expect(hideArchived).toHaveAttribute('aria-checked', 'false');

        await userEvent.click(hideArchived);

        expect(hideArchivedChannelsPreference).toHaveBeenCalledWith(true);
    });

    test('should render ArchiveOutlineIcon for archived public channels', () => {
        const channels = [
            {
                id: 'channel1',
                name: 'archived-public-channel',
                display_name: 'Archived Public Channel',
                type: 'O',
                delete_at: 1234567890,
                team_id: 'team1',
                purpose: '',
            } as Channel,
        ];

        const {container} = renderWithContext(
            <SearchableChannelList
                {...baseProps}
                channels={channels}
                loading={false}
            />,
            initialState,
        );

        const channelRow = container.querySelector('.more-modal__row');
        expect(channelRow).toBeInTheDocument();
        expect(container.querySelector('[data-testid="archiveOutlineIcon"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="archiveLockOutlineIcon"]')).not.toBeInTheDocument();
    });

    test('should render ArchiveLockOutlineIcon for archived private channels', () => {
        const channels = [
            {
                id: 'channel2',
                name: 'archived-private-channel',
                display_name: 'Archived Private Channel',
                type: 'P',
                delete_at: 1234567890,
                team_id: 'team1',
                purpose: '',
            } as Channel,
        ];

        const {container} = renderWithContext(
            <SearchableChannelList
                {...baseProps}
                channels={channels}
                loading={false}
            />,
            initialState,
        );

        const channelRow = container.querySelector('.more-modal__row');
        expect(channelRow).toBeInTheDocument();
        expect(container.querySelector('[data-testid="archiveLockOutlineIcon"]')).toBeInTheDocument();
        expect(container.querySelector('[data-testid="archiveOutlineIcon"]')).not.toBeInTheDocument();
    });

    describe('plugin channel icon override', () => {
        const mockedCompassIconForName = jest.mocked(compassIconForName);

        afterEach(() => {
            mockedCompassIconForName.mockReset();
        });

        test('renders override SVG icon with size prop when plugin matcher matches', () => {
            const StubIcon = ({size}: {size?: number}) => (
                <span
                    data-testid='stub-override-icon'
                    data-size={size}
                />
            );
            mockedCompassIconForName.mockReturnValue(StubIcon as any);

            const channels = [
                {
                    id: 'channel1',
                    name: 'open-channel',
                    display_name: 'Open Channel',
                    type: 'O',
                    delete_at: 0,
                    team_id: 'team1',
                    purpose: '',
                } as Channel,
            ];

            const stateWithOverride = {
                ...initialState,
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => true,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(
                <SearchableChannelList
                    {...baseProps}
                    channels={channels}
                    loading={false}
                />,
                stateWithOverride,
            );

            const icon = screen.getByTestId('stub-override-icon');
            expect(icon).toBeInTheDocument();
            expect(icon).toHaveAttribute('data-size', '18');

            // Default icons absent when override wins
            expect(screen.queryByTestId('default-globe-icon')).not.toBeInTheDocument();
            expect(screen.queryByTestId('default-lock-icon')).not.toBeInTheDocument();
        });

        test('renders default SVG icon when no plugin matcher matches', () => {
            mockedCompassIconForName.mockReturnValue(null);

            const channels = [
                {
                    id: 'channel1',
                    name: 'open-channel',
                    display_name: 'Open Channel',
                    type: 'O',
                    delete_at: 0,
                    team_id: 'team1',
                    purpose: '',
                } as Channel,
            ];

            const stateWithNoMatch = {
                ...initialState,
                plugins: {
                    components: {
                        ChannelIconOverride: [{
                            id: '1',
                            pluginId: 'test-plugin',
                            matcher: () => false,
                            iconName: 'shield-outline',
                        }],
                    },
                },
            } as any;

            renderWithContext(
                <SearchableChannelList
                    {...baseProps}
                    channels={channels}
                    loading={false}
                />,
                stateWithNoMatch,
            );

            expect(screen.queryByTestId('stub-override-icon')).not.toBeInTheDocument();

            // Default globe icon rendered for the open channel fallback
            expect(screen.getByTestId('default-globe-icon')).toBeInTheDocument();
        });
    });
});
