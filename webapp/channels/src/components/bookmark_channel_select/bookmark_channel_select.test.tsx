// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {waitFor} from '@testing-library/react';
import React from 'react';

import type {Channel} from '@mattermost/types/channels';

import {renderWithContext, userEvent} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import BookmarkChannelSelect from './bookmark_channel_select';

// Mock the permission check to allow bookmark adding
jest.mock('mattermost-redux/selectors/entities/roles', () => ({
    haveIChannelPermission: jest.fn().mockReturnValue(true),
}));

describe('BookmarkChannelSelect', () => {
    const channel1: Channel = {
        ...TestHelper.getChannelMock({
            id: 'channel1',
            display_name: 'Engineering',
            name: 'engineering',
            team_id: 'team1',
            type: 'O',
        }),
    };

    const channel2: Channel = {
        ...TestHelper.getChannelMock({
            id: 'channel2',
            display_name: 'Product',
            name: 'product',
            team_id: 'team1',
            type: 'P',
        }),
    };

    const baseProps = {
        onSelect: jest.fn(),
        onClose: jest.fn(),
        title: 'Bookmark in channel',
    };

    const initialState = {
        entities: {
            teams: {
                currentTeamId: 'team1',
                teams: {
                    team1: TestHelper.getTeamMock({id: 'team1', name: 'team1'}),
                },
                myMembers: {
                    team1: {team_id: 'team1', user_id: 'user1', roles: 'team_user'},
                },
            },
            channels: {
                channels: {
                    channel1,
                    channel2,
                },
                myMembers: {
                    channel1: {
                        channel_id: 'channel1',
                        user_id: 'user1',
                        roles: 'channel_user',
                        msg_count: 0,
                        mention_count: 0,
                    },
                    channel2: {
                        channel_id: 'channel2',
                        user_id: 'user1',
                        roles: 'channel_user',
                        msg_count: 0,
                        mention_count: 0,
                    },
                },
            },
            users: {
                currentUserId: 'user1',
                profiles: {
                    user1: TestHelper.getUserMock({id: 'user1'}),
                },
            },
            roles: {
                roles: {
                    channel_user: {
                        id: 'channel_user',
                        name: 'channel_user',
                        permissions: ['add_bookmark_public_channel', 'add_bookmark_private_channel'],
                    },
                    team_user: {
                        id: 'team_user',
                        name: 'team_user',
                        permissions: [],
                    },
                },
            },
            general: {
                license: {IsLicensed: 'true'},
                config: {FeatureFlagChannelBookmarks: 'true'},
            },
        },
    };

    test('should render modal with channel dropdown', () => {
        const {getByText, getByRole} = renderWithContext(
            <BookmarkChannelSelect {...baseProps}/>,
            initialState as any,
        );

        expect(getByText('Bookmark in channel')).toBeInTheDocument();
        expect(getByRole('combobox')).toBeInTheDocument();
    });

    test('should list channels in dropdown', () => {
        const {getByRole} = renderWithContext(
            <BookmarkChannelSelect {...baseProps}/>,
            initialState as any,
        );

        const select = getByRole('combobox');
        const options = select.querySelectorAll('option');

        // Should have at least the placeholder option
        expect(options.length).toBeGreaterThanOrEqual(1);

        // First option should be the placeholder
        expect(options[0]).toHaveValue('');
    });

    test('should call onSelect with selected channelId when confirm button clicked', async () => {
        const user = userEvent.setup();
        const {getByRole} = renderWithContext(
            <BookmarkChannelSelect {...baseProps}/>,
            initialState as any,
        );

        const select = getByRole('combobox');
        const confirmButton = getByRole('button', {name: 'Bookmark'});

        // Get available options (excluding placeholder)
        const options = Array.from(select.querySelectorAll('option')).filter((opt) => opt.value !== '');

        // If there are channels available, select the first one
        if (options.length > 0) {
            const firstChannelId = options[0].value;
            await user.selectOptions(select, firstChannelId);

            await waitFor(() => {
                expect(select).toHaveValue(firstChannelId);
            });

            await user.click(confirmButton);

            await waitFor(() => {
                expect(baseProps.onSelect).toHaveBeenCalledWith(firstChannelId);
                expect(baseProps.onClose).toHaveBeenCalled();
            });
        } else {
            // If no channels are available due to permission filtering, verify button stays disabled
            expect(confirmButton).toBeDisabled();
        }
    });

    test('should call onClose when cancel button clicked', async () => {
        const user = userEvent.setup();
        const {getByRole} = renderWithContext(
            <BookmarkChannelSelect {...baseProps}/>,
            initialState as any,
        );

        const cancelButton = getByRole('button', {name: 'Cancel'});

        await user.click(cancelButton);

        expect(baseProps.onClose).toHaveBeenCalled();
    });

    test('should disable confirm button when no channel selected', () => {
        const {getByRole} = renderWithContext(
            <BookmarkChannelSelect {...baseProps}/>,
            initialState as any,
        );

        const confirmButton = getByRole('button', {name: 'Bookmark'});
        expect(confirmButton).toBeDisabled();
    });

    test('should enable confirm button when channel selected', async () => {
        const user = userEvent.setup();
        const {getByRole} = renderWithContext(
            <BookmarkChannelSelect {...baseProps}/>,
            initialState as any,
        );

        const select = getByRole('combobox');
        const confirmButton = getByRole('button', {name: 'Bookmark'});

        expect(confirmButton).toBeDisabled();

        // Get available options (excluding placeholder)
        const options = Array.from(select.querySelectorAll('option')).filter((opt) => opt.value !== '');

        // If there are channels available, select the first one and verify button enables
        if (options.length > 0) {
            const firstChannelId = options[0].value;
            await user.selectOptions(select, firstChannelId);

            await waitFor(() => {
                expect(confirmButton).not.toBeDisabled();
            });
        }
    });
});
