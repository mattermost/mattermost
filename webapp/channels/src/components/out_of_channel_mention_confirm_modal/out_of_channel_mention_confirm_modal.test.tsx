// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import {addChannelMembers} from 'mattermost-redux/actions/channels';
import {savePreferences} from 'mattermost-redux/actions/preferences';
import {Preferences} from 'mattermost-redux/constants';

import {suppressOutOfChannelEphemeralPost} from 'actions/views/out_of_channel_mention';

import OutOfChannelMentionConfirmModal from 'components/out_of_channel_mention_confirm_modal/out_of_channel_mention_confirm_modal';

import {renderWithContext, screen, userEvent} from 'tests/react_testing_utils';
import Constants from 'utils/constants';
import {TestHelper} from 'utils/test_helper';

jest.mock('mattermost-redux/actions/channels', () => ({
    addChannelMembers: jest.fn(() => () => Promise.resolve({data: true})),
}));

jest.mock('mattermost-redux/actions/preferences', () => ({
    savePreferences: jest.fn(() => ({type: 'MOCK_SAVE_PREFERENCES'})),
}));

jest.mock('actions/views/out_of_channel_mention', () => ({
    suppressOutOfChannelEphemeralPost: jest.fn(() => () => ({type: 'SUPPRESS_OUT_OF_CHANNEL_EPHEMERAL'})),
}));

describe('OutOfChannelMentionConfirmModal', () => {
    const baseProps = {
        addable: [TestHelper.getUserMock({id: 'user1', username: 'alice'})],
        notAddable: [],
        outOfTeam: [],
        channelId: 'channel_id',
        channelType: Constants.OPEN_CHANNEL,
        rootId: '',
        isPolicyEnforced: false,
        onSend: jest.fn(),
        onExited: jest.fn(),
    };

    const currentUserState = {
        entities: {
            users: {
                currentUserId: 'current_user_id',
                profiles: {
                    current_user_id: TestHelper.getUserMock({id: 'current_user_id'}),
                },
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders public channel copy for a single addable user', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal {...baseProps}/>,
        );

        expect(screen.getByText('Add mentioned person to this channel?')).toBeInTheDocument();
        expect(screen.getByText('alice')).toBeInTheDocument();
        expect(screen.getByText(/isn't in this channel\. Add them so they'll be notified\./)).toBeInTheDocument();
    });

    it('renders public channel copy for multiple addable users', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal
                {...baseProps}
                addable={[
                    TestHelper.getUserMock({id: 'user1', username: 'bob-sample'}),
                    TestHelper.getUserMock({id: 'user2', username: 'carol-sample'}),
                ]}
            />,
        );

        expect(screen.getByText('Add mentioned people to this channel?')).toBeInTheDocument();
        expect(screen.getByText('bob-sample and carol-sample')).toBeInTheDocument();
        expect(screen.getByText(/aren't in this channel\. Add them so they'll be notified\./)).toBeInTheDocument();
    });

    it('renders private channel copy for multiple addable users', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal
                {...baseProps}
                channelType={Constants.PRIVATE_CHANNEL}
                addable={[
                    TestHelper.getUserMock({id: 'user1', username: 'bob-sample'}),
                    TestHelper.getUserMock({id: 'user2', username: 'carol-sample'}),
                ]}
            />,
        );

        expect(screen.getByText('Add mentioned people to this private channel?')).toBeInTheDocument();
        expect(screen.getByText('bob-sample and carol-sample')).toBeInTheDocument();
        expect(screen.getByText(/aren't in this private channel\. Add them so they'll be notified\./)).toBeInTheDocument();
        expect(screen.getByText(/read all past messages in the channel/)).toBeInTheDocument();
    });

    it('renders teammate names using the display name preference', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal
                {...baseProps}
                addable={[TestHelper.getUserMock({
                    id: 'user1',
                    username: 'alice',
                    first_name: 'Alice',
                    last_name: 'Example',
                })]}
            />,
            {
                entities: {
                    preferences: {
                        myPreferences: {
                            [`${Preferences.CATEGORY_DISPLAY_SETTINGS}--${Preferences.NAME_NAME_FORMAT}`]: {
                                category: Preferences.CATEGORY_DISPLAY_SETTINGS,
                                name: Preferences.NAME_NAME_FORMAT,
                                user_id: 'current_user_id',
                                value: Preferences.DISPLAY_PREFER_FULL_NAME,
                            },
                        },
                    },
                },
            },
        );

        expect(screen.getByText('Alice Example')).toBeInTheDocument();
    });

    it('calls onSend when send without adding is clicked', async () => {
        const onSend = jest.fn();
        renderWithContext(
            <OutOfChannelMentionConfirmModal
                {...baseProps}
                onSend={onSend}
            />,
        );

        await userEvent.click(screen.getByText('Send without adding'));
        expect(suppressOutOfChannelEphemeralPost).toHaveBeenCalledWith('channel_id', '');
        expect(onSend).toHaveBeenCalled();
    });

    it('disables add button when no addable users', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal
                {...baseProps}
                addable={[]}
                notAddable={[TestHelper.getUserMock({id: 'user2', username: 'bob'})]}
            />,
        );

        expect(screen.getByRole('button', {name: /Add to channel and send/})).toBeDisabled();
        expect(screen.getByText("Person you mentioned isn't in this channel")).toBeInTheDocument();
    });

    it('does not render cancel button', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal {...baseProps}/>,
        );

        expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    });

    it('renders out-of-team users with channel messaging', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal
                {...baseProps}
                addable={[]}
                outOfTeam={[TestHelper.getUserMock({id: 'user3', username: 'carol'})]}
            />,
        );

        expect(screen.getByText('carol')).toBeInTheDocument();
        expect(screen.getByText(/isn't in this channel and won't be notified/)).toBeInTheDocument();
        expect(screen.getByText(/not on this team, so they can't be added to the channel/)).toBeInTheDocument();
    });

    it('renders the do not ask again checkbox unchecked', () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal {...baseProps}/>,
        );

        expect(screen.getByRole('checkbox', {name: /Don't ask me again/})).not.toBeChecked();
    });

    it('saves skip preference when send without adding is clicked with checkbox checked', async () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal {...baseProps}/>,
            currentUserState,
        );

        await userEvent.click(screen.getByRole('checkbox', {name: /Don't ask me again/}));
        await userEvent.click(screen.getByText('Send without adding'));

        expect(savePreferences).toHaveBeenCalledWith('current_user_id', [{
            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
            name: Preferences.OUT_OF_CHANNEL_MENTION_SKIP_CONFIRM,
            user_id: 'current_user_id',
            value: 'true',
        }]);
        expect(suppressOutOfChannelEphemeralPost).toHaveBeenCalledWith('channel_id', '');
        expect(baseProps.onSend).toHaveBeenCalled();
    });

    it('does not save skip preference when send without adding is clicked without checkbox', async () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal {...baseProps}/>,
        );

        await userEvent.click(screen.getByText('Send without adding'));

        expect(savePreferences).not.toHaveBeenCalled();
    });

    it('saves skip preference when add and send is clicked with checkbox checked', async () => {
        renderWithContext(
            <OutOfChannelMentionConfirmModal {...baseProps}/>,
            currentUserState,
        );

        await userEvent.click(screen.getByRole('checkbox', {name: /Don't ask me again/}));
        await userEvent.click(screen.getByText('Add to channel and send'));

        expect(addChannelMembers).toHaveBeenCalledWith('channel_id', ['user1'], '');
        expect(savePreferences).toHaveBeenCalledWith('current_user_id', [{
            category: Preferences.CATEGORY_ADVANCED_SETTINGS,
            name: Preferences.OUT_OF_CHANNEL_MENTION_SKIP_CONFIRM,
            user_id: 'current_user_id',
            value: 'true',
        }]);
        expect(baseProps.onSend).toHaveBeenCalled();
    });
});
