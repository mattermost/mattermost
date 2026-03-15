// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {Recap} from '@mattermost/types/recaps';
import {RecapStatus} from '@mattermost/types/recaps';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';

import RecapItem from './recap_item';

const mockDispatch = jest.fn();
const mockAgents: any[] = [];

jest.mock('react-redux', () => ({
    ...jest.requireActual('react-redux'),
    useDispatch: () => mockDispatch,
}));

jest.mock('mattermost-redux/actions/channels', () => ({
    readMultipleChannels: jest.fn((channelIds) => ({type: 'READ_MULTIPLE_CHANNELS', channelIds})),
}));

jest.mock('mattermost-redux/actions/recaps', () => ({
    markRecapAsRead: jest.fn((recapId) => ({type: 'MARK_RECAP_AS_READ', recapId})),
    deleteRecap: jest.fn((recapId) => ({type: 'DELETE_RECAP', recapId})),
    regenerateRecap: jest.fn((recapId) => ({type: 'REGENERATE_RECAP', recapId})),
}));

jest.mock('mattermost-redux/selectors/entities/agents', () => ({
    getAgents: () => mockAgents,
}));

jest.mock('components/common/hooks/useGetAgentsBridgeEnabled', () => ({
    __esModule: true,
    default: () => true,
}));

jest.mock('components/confirm_modal', () => {
    return function ConfirmModal() {
        return null;
    };
});

jest.mock('./recap_channel_card', () => {
    return function RecapChannelCard() {
        return <div data-testid='recap-channel-card'/>;
    };
});

jest.mock('./recap_processing', () => {
    return function RecapProcessing() {
        return <div data-testid='recap-processing'/>;
    };
});

jest.mock('./recap_menu', () => {
    return function RecapMenu({actions, ariaLabel}: {actions: any[]; ariaLabel?: string}) {
        return (
            <div
                data-testid='recap-menu'
                aria-label={ariaLabel}
            >
                {actions.map((action) => (
                    <button
                        key={action.id}
                        onClick={action.onClick}
                        data-testid={`menu-action-${action.id}`}
                    >
                        {action.label}
                    </button>
                ))}
            </div>
        );
    };
});

describe('RecapItem', () => {
    const baseRecap: Recap = {
        id: 'recap1',
        title: 'MM-67831 seeded recap',
        user_id: 'user1',
        bot_id: 'bot1',
        status: RecapStatus.COMPLETED,
        create_at: 1000,
        update_at: 1000,
        delete_at: 0,
        read_at: 0,
        channels: [
            {
                id: 'recap_channel1',
                recap_id: 'recap1',
                channel_id: 'channel1',
                channel_name: 'town-square',
                highlights: ['One highlight'],
                action_items: ['One action item'],
                source_post_ids: [],
                create_at: 1000,
            },
        ],
        total_message_count: 4,
    };

    beforeEach(() => {
        mockDispatch.mockClear();
        jest.clearAllMocks();
    });

    test('shows mark read button and full menu for unread recaps', () => {
        renderWithContext(
            <RecapItem
                recap={baseRecap}
                isExpanded={false}
                onToggle={jest.fn()}
            />,
        );

        expect(screen.getByRole('button', {name: 'Mark read'})).toBeInTheDocument();
        expect(screen.getByTestId('recap-menu')).toBeInTheDocument();
        expect(screen.getByTestId('menu-action-mark-all-channels-read')).toBeInTheDocument();
        expect(screen.getByTestId('menu-action-regenerate-recap')).toBeInTheDocument();
    });

    test('keeps mark all channels action available after the recap is read', async () => {
        const {readMultipleChannels} = require('mattermost-redux/actions/channels');
        const user = userEvent.setup();

        renderWithContext(
            <RecapItem
                recap={{
                    ...baseRecap,
                    read_at: 1234,
                }}
                isExpanded={false}
                onToggle={jest.fn()}
            />,
        );

        expect(screen.queryByRole('button', {name: 'Mark read'})).not.toBeInTheDocument();
        expect(screen.getByTestId('recap-menu')).toBeInTheDocument();
        expect(screen.getByTestId('menu-action-mark-all-channels-read')).toBeInTheDocument();
        expect(screen.queryByTestId('menu-action-regenerate-recap')).not.toBeInTheDocument();

        await user.click(screen.getByTestId('menu-action-mark-all-channels-read'));

        expect(mockDispatch).toHaveBeenCalled();
        expect(readMultipleChannels).toHaveBeenCalledWith(['channel1']);
    });
});
