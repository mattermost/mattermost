// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import type {UserPropertyField} from '@mattermost/types/properties_user';

import ProfilePopoverCallButtonWrapper from 'components/profile_popover/profile_popover_call_button_wrapper';

import CallButton from 'plugins/call_button/call_button';
import {renderWithContext, screen, userEvent, waitFor} from 'tests/react_testing_utils';
import {TestHelper} from 'utils/test_helper';

import type {CallButtonAction} from 'types/store/plugins';

import {getDialablePhones} from './use_phone_call_options';

const currentUserId = 'current_user';
const userId = 'user1';
const dmChannel = TestHelper.getChannelMock({
    id: 'dm_channel_id',
    name: `${currentUserId}__${userId}`,
    display_name: `${currentUserId}__${userId}`,
    type: 'D',
    delete_at: 0,
});
const openChannel = TestHelper.getChannelMock({id: 'open_channel_id', name: 'town-square', type: 'O', delete_at: 0});
const channelMember = TestHelper.getChannelMembershipMock({channel_id: dmChannel.id});

const phoneField = (id: string, name: string, attrs: Partial<UserPropertyField['attrs']> = {}) => ({
    id,
    name,
    type: 'text',
    attrs: {sort_order: 0, visibility: 'when_set', value_type: 'phone', ...attrs},
} as UserPropertyField);

const dsnField = phoneField('dsn', 'DSN');

const makeCallButton = (withPhoneAction = true) => ({
    id: 'call_button',
    pluginId: 'com.mattermost.calls',
    button: <button>{'Plugin call button'}</button>,
    dropdownButton: <span>{'Plugin dropdown button'}</span>,
    action: jest.fn(),
    phoneAction: withPhoneAction ? jest.fn() : undefined,
} as unknown as CallButtonAction);

const makeState = (opts: {callButtons: CallButtonAction[]; dialing?: boolean; sessions?: object}) => ({
    'plugins-com.mattermost.calls': {
        callsConfig: {DefaultEnabled: true, EnableSIPOutbound: opts.dialing ?? true},
        sessions: opts.sessions ?? {},
        channels: {},
    },
    plugins: {
        plugins: {'com.mattermost.calls': {id: 'com.mattermost.calls', version: '1.0.0'}},
        components: {CallButton: opts.callButtons},
    },
    entities: {
        general: {customProfileAttributes: {[dsnField.id]: dsnField}},
        channels: {
            currentChannelId: dmChannel.id,
            channels: {[dmChannel.id]: dmChannel},
            myMembers: {[dmChannel.id]: channelMember},
        },
        users: {
            currentUserId,
            profiles: {
                [currentUserId]: TestHelper.getUserMock({id: currentUserId, roles: 'system_user'}),
                [userId]: TestHelper.getUserMock({id: userId, username: 'leonard', custom_profile_attributes: {[dsnField.id]: '312-555-0174'}}),
            },
        },
    },
    views: {rhs: {isSidebarOpen: false}},
});

describe('getDialablePhones', () => {
    test('returns the phone attributes that have a value', () => {
        const fields = [
            dsnField,
            phoneField('mobile', 'mobile_phone', {display_name: 'Mobile'}),
            phoneField('empty', 'Empty'),
            {...phoneField('email', 'Email'), attrs: {...dsnField.attrs, value_type: 'email'}} as UserPropertyField,
        ];

        expect(getDialablePhones(fields, {dsn: ' 312-555-0174 ', mobile: '+1 555 0100', empty: '', email: 'a@b.c'})).toEqual([
            {fieldId: 'dsn', label: 'DSN', number: '312-555-0174'},
            {fieldId: 'mobile', label: 'Mobile', number: '+1 555 0100'},
        ]);
    });

    test('skips attributes the profile popover hides', () => {
        const fields = [
            phoneField('hidden', 'Hidden', {visibility: 'hidden'}),
            phoneField('source_only', 'Source only', {access_mode: 'source_only'}),
        ];

        expect(getDialablePhones(fields, {hidden: '1', source_only: '2'})).toEqual([]);
    });

    test('is empty until the values load', () => {
        expect(getDialablePhones([dsnField], undefined)).toEqual([]);
    });
});

describe('profile popover call button', () => {
    const renderPopoverButton = (state: ReturnType<typeof makeState>, hide = jest.fn()) => renderWithContext(
        <ProfilePopoverCallButtonWrapper
            userId={userId}
            currentUserId={currentUserId}
            fullname='Leonard Riley'
            username='leonard'
            hide={hide}
        />,
        state,
        {pluginReducers: ['plugins-com.mattermost.calls']},
    );

    test('opens the menu instead of starting a call', async () => {
        const callButton = makeCallButton();
        renderPopoverButton(makeState({callButtons: [callButton]}));

        await userEvent.click(screen.getByRole('button', {name: 'Call options'}));

        expect(screen.getByText('Start an Audio Call')).toBeInTheDocument();
        expect(screen.getByText('Call DSN')).toBeInTheDocument();
        expect(screen.getByText('312-555-0174 • Phone call')).toBeInTheDocument();
        expect(callButton.action).not.toHaveBeenCalled();
    });

    test('dials a number through the plugin and closes the popover', async () => {
        const callButton = makeCallButton();
        const hide = jest.fn();
        renderPopoverButton(makeState({callButtons: [callButton]}), hide);

        await userEvent.click(screen.getByRole('button', {name: 'Call options'}));
        await userEvent.click(screen.getByText('Call DSN'));

        await waitFor(() => expect(callButton.phoneAction).toHaveBeenCalledWith({number: '312-555-0174', userId, label: 'DSN', fieldId: 'dsn'}));
        expect(hide).toHaveBeenCalled();
        expect(callButton.action).not.toHaveBeenCalled();
    });

    test('starts a call in the DM from the menu', async () => {
        const callButton = makeCallButton();
        renderPopoverButton(makeState({callButtons: [callButton]}));

        await userEvent.click(screen.getByRole('button', {name: 'Call options'}));
        await userEvent.click(screen.getByText('Start an Audio Call'));

        await waitFor(() => expect(callButton.action).toHaveBeenCalledWith(dmChannel, channelMember));
    });

    test.each([
        ['the plugin has no phone action', {callButtons: [makeCallButton(false)]}],
        ['outbound dialing is off', {callButtons: [makeCallButton()], dialing: false}],
    ])('keeps the plain button when %s', async (_label, opts) => {
        renderPopoverButton(makeState(opts));

        expect(screen.queryByRole('button', {name: 'Call options'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByLabelText('Start Call'));
        expect(opts.callButtons[0].action).toHaveBeenCalledWith(dmChannel, channelMember);
    });

    test('keeps the disabled button while a call is ongoing', () => {
        renderPopoverButton(makeState({
            callButtons: [makeCallButton()],
            sessions: {[dmChannel.id]: {session1: {user_id: userId}}},
        }));

        expect(screen.queryByRole('button', {name: 'Call options'})).not.toBeInTheDocument();
        expect(screen.getByLabelText('Call with Leonard Riley is ongoing')).toBeDisabled();
    });
});

describe('channel header call button', () => {
    const renderHeaderButton = (callButtons: CallButtonAction[], channel = dmChannel, state = makeState({callButtons})) => renderWithContext(
        <CallButton
            pluginCallComponents={callButtons}
            currentChannel={channel}
            channelMember={channelMember}
            sidebarOpen={false}
        />,
        state,
        {pluginReducers: ['plugins-com.mattermost.calls']},
    );

    test('in a DM, opens the menu instead of starting a call', async () => {
        const callButton = makeCallButton();
        renderHeaderButton([callButton]);

        expect(screen.getByText('Start call')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Call options'}));

        expect(screen.getByText('Call DSN')).toBeInTheDocument();
        expect(callButton.action).not.toHaveBeenCalled();
    });

    test('dials a number or starts a call from the menu', async () => {
        const callButton = makeCallButton();
        renderHeaderButton([callButton]);

        await userEvent.click(screen.getByRole('button', {name: 'Call options'}));
        await userEvent.click(screen.getByText('Call DSN'));
        await waitFor(() => expect(callButton.phoneAction).toHaveBeenCalledWith({number: '312-555-0174', userId, label: 'DSN', fieldId: 'dsn'}));

        await userEvent.click(screen.getByRole('button', {name: 'Call options'}));
        await userEvent.click(screen.getByText('Start an Audio Call'));
        await waitFor(() => expect(callButton.action).toHaveBeenCalledWith(dmChannel, channelMember));
    });

    test('outside a DM, keeps the plugin button', async () => {
        const callButton = makeCallButton();
        renderHeaderButton([callButton], openChannel);

        expect(screen.queryByRole('button', {name: 'Call options'})).not.toBeInTheDocument();
        await userEvent.click(screen.getByText('Plugin call button'));
        expect(callButton.action).toHaveBeenCalled();
    });

    test('keeps the plugin button while a call is ongoing', () => {
        const callButton = makeCallButton();
        renderHeaderButton([callButton], dmChannel, makeState({
            callButtons: [callButton],
            sessions: {[dmChannel.id]: {session1: {user_id: userId}}},
        }));

        expect(screen.queryByRole('button', {name: 'Call options'})).not.toBeInTheDocument();
        expect(screen.getByText('Plugin call button')).toBeInTheDocument();
    });

    test('with two call plugins, keeps the multi-plugin dropdown', () => {
        renderHeaderButton([makeCallButton(), {...makeCallButton(), id: 'other_call_button'} as CallButtonAction]);

        expect(screen.queryByRole('button', {name: 'Call options'})).not.toBeInTheDocument();
        expect(screen.getByText('Call')).toBeInTheDocument();
    });
});
