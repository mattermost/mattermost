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

const makeCallButton = (withPhoneAction = true, extra: Partial<CallButtonAction> = {}) => ({
    id: 'call_button',
    pluginId: 'com.mattermost.calls',
    button: <button>{'Plugin call button'}</button>,
    dropdownButton: <span>{'Plugin dropdown button'}</span>,
    action: jest.fn(),
    phoneAction: withPhoneAction ? jest.fn() : undefined,
    ...extra,
} as unknown as CallButtonAction);

const makeStartMenuCallButton = (withPhoneAction = true, extra: Partial<CallButtonAction> = {}) => makeCallButton(withPhoneAction, {
    copyCallLinkAction: jest.fn(),
    callSettingsAction: jest.fn(),
    ...extra,
});

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

const inCallSessions = {[dmChannel.id]: {session1: {user_id: currentUserId}}};

const renderOptions = {pluginReducers: ['plugins-com.mattermost.calls']};

describe.each([
    ['channel header', (callButton: CallButtonAction, state: ReturnType<typeof makeState>, hide = jest.fn()) => ({
        hide,
        ...renderWithContext(
            <CallButton
                pluginCallComponents={[callButton]}
                currentChannel={dmChannel}
                channelMember={channelMember}
                sidebarOpen={false}
            />,
            state,
            renderOptions,
        ),
    })],
    ['profile popover', (_callButton: CallButtonAction, state: ReturnType<typeof makeState>, hide = jest.fn()) => ({
        hide,
        ...renderWithContext(
            <ProfilePopoverCallButtonWrapper
                userId={userId}
                currentUserId={currentUserId}
                fullname='Leonard Riley'
                username='leonard'
                hide={hide}
            />,
            state,
            renderOptions,
        ),
    })],
])('Start call menu in the %s', (surface, renderButton) => {
    const openMenu = () => userEvent.click(screen.getByRole('button', {name: 'Start call'}));
    const menuItemNames = () => screen.getAllByRole('menuitem').map((item) => item.textContent);

    test('without phone numbers, offers a call, the call link and call settings, with no group headings', async () => {
        const callButton = makeStartMenuCallButton(false);
        renderButton(callButton, makeState({callButtons: [callButton]}));

        await openMenu();

        expect(menuItemNames()).toEqual(['Start call', 'Copy call link', 'Call settings']);
        expect(screen.getAllByRole('separator')).toHaveLength(1);
        expect(screen.queryByText('Mattermost call')).not.toBeInTheDocument();
        expect(screen.queryByText('Phone call')).not.toBeInTheDocument();
        expect(callButton.action).not.toHaveBeenCalled();
    });

    test('with phone numbers, groups the Mattermost call and phone call rows under headings', async () => {
        const callButton = makeStartMenuCallButton();
        renderButton(callButton, makeState({callButtons: [callButton]}));

        await openMenu();

        expect(menuItemNames()).toEqual(['Start call', 'Copy call link', 'Call DSN312-555-0174', 'Call settings']);
        expect(screen.getByText('Mattermost call')).toBeInTheDocument();
        expect(screen.getByText('Phone call')).toBeInTheDocument();
        expect(screen.getByRole('menuitem', {name: 'Start call'})).toHaveAccessibleDescription('Mattermost call');
        expect(screen.getByRole('menuitem', {name: /Call DSN/})).toHaveAccessibleDescription('Phone call');
    });

    test('runs each action through the plugin', async () => {
        const callButton = makeStartMenuCallButton();
        const {hide} = renderButton(callButton, makeState({callButtons: [callButton]}));

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Copy call link'}));
        await waitFor(() => expect(callButton.copyCallLinkAction).toHaveBeenCalledWith({userId, channel: dmChannel}));

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Call settings'}));
        await waitFor(() => expect(callButton.callSettingsAction).toHaveBeenCalled());

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: /Call DSN/}));
        await waitFor(() => expect(callButton.phoneAction).toHaveBeenCalledWith({number: '312-555-0174', userId, label: 'DSN', fieldId: 'dsn'}));

        await openMenu();
        await userEvent.click(screen.getByRole('menuitem', {name: 'Start call'}));
        await waitFor(() => expect(callButton.action).toHaveBeenCalledWith(dmChannel, channelMember));

        if (surface === 'profile popover') {
            expect(hide).toHaveBeenCalledTimes(4);
        }
    });

    test('leaves out the rows for actions the plugin does not pass', async () => {
        const callButton = makeStartMenuCallButton(false, {copyCallLinkAction: undefined});
        renderButton(callButton, makeState({callButtons: [callButton]}));

        await openMenu();

        expect(menuItemNames()).toEqual(['Start call', 'Call settings']);
    });

    test('works from the keyboard and returns focus to the button on Escape', async () => {
        const callButton = makeStartMenuCallButton();
        renderButton(callButton, makeState({callButtons: [callButton]}));
        const button = screen.getByRole('button', {name: 'Start call'});
        expect(button).toHaveAttribute('aria-haspopup', 'true');
        expect(button).toHaveAttribute('aria-expanded', 'false');

        button.focus();
        await userEvent.keyboard('{Enter}');

        expect(button).toHaveAttribute('aria-expanded', 'true');
        await waitFor(() => expect(screen.getByRole('menuitem', {name: 'Start call'})).toHaveFocus());
        await userEvent.keyboard('{ArrowDown}');
        expect(screen.getByRole('menuitem', {name: 'Copy call link'})).toHaveFocus();
        await userEvent.keyboard('{End}');
        expect(screen.getByRole('menuitem', {name: 'Call settings'})).toHaveFocus();
        await userEvent.keyboard('{Home}');
        expect(screen.getByRole('menuitem', {name: 'Start call'})).toHaveFocus();

        await userEvent.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
        expect(button).toHaveFocus();
    });

    test('shows the pressed In call button, with no menu, during a call', async () => {
        const callButton = makeStartMenuCallButton();
        renderButton(callButton, makeState({callButtons: [callButton], sessions: inCallSessions}));

        const button = screen.getByRole('button', {name: 'In call'});
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(button).not.toHaveAttribute('aria-haspopup');
        expect(screen.queryByRole('button', {name: 'Start call'})).not.toBeInTheDocument();

        await userEvent.click(button);

        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(callButton.action).not.toHaveBeenCalled();
    });

    test('prefers the plugin\'s own in-call state over sessions', () => {
        const ringing = makeStartMenuCallButton(false, {isInCall: () => true});
        const {unmount} = renderButton(ringing, makeState({callButtons: [ringing]}));
        expect(screen.getByRole('button', {name: 'In call'})).toBeInTheDocument();
        unmount();

        const notInCall = makeStartMenuCallButton(false, {isInCall: () => false});
        renderButton(notInCall, makeState({callButtons: [notInCall], sessions: inCallSessions}));
        expect(screen.getByRole('button', {name: 'Start call'})).toBeInTheDocument();
    });

    test('moves focus to the In call button when a call starts while the Start call button has focus', async () => {
        const callButton = makeStartMenuCallButton(false);
        const {updateStoreState} = renderButton(callButton, makeState({callButtons: [callButton]}));
        screen.getByRole('button', {name: 'Start call'}).focus();

        updateStoreState(makeState({callButtons: [callButton], sessions: inCallSessions}));

        await waitFor(() => expect(screen.getByRole('button', {name: 'In call'})).toHaveFocus());
    });

    test('moves focus to the In call button when a call starts while the menu has focus', async () => {
        const callButton = makeStartMenuCallButton(false);
        const {updateStoreState} = renderButton(callButton, makeState({callButtons: [callButton]}));
        screen.getByRole('button', {name: 'Start call'}).focus();
        await userEvent.keyboard('{Enter}');
        await waitFor(() => expect(screen.getByRole('menuitem', {name: 'Start call'})).toHaveFocus());

        updateStoreState(makeState({callButtons: [callButton], sessions: inCallSessions}));

        await waitFor(() => expect(screen.getByRole('button', {name: 'In call'})).toHaveFocus());
    });

    test('leaves focus alone when a call starts while focus is elsewhere', async () => {
        const callButton = makeStartMenuCallButton(false);
        const {updateStoreState} = renderButton(callButton, makeState({callButtons: [callButton]}));
        const elsewhere = document.createElement('button');
        document.body.appendChild(elsewhere);
        screen.getByRole('button', {name: 'Start call'}).focus();
        elsewhere.focus();

        updateStoreState(makeState({callButtons: [callButton], sessions: inCallSessions}));

        await screen.findByRole('button', {name: 'In call'});
        expect(elsewhere).toHaveFocus();
        elsewhere.remove();
    });
});
