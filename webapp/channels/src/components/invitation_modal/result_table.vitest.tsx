// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import deepFreeze from 'mattermost-redux/utils/deep_freeze';

import {renderWithContext, screen} from 'tests/vitest_react_testing_utils';

import ResultTable from './result_table';
import type {Props} from './result_table';

let props: Props = {
    sent: true,
    rows: [],
};

const defaultUser = deepFreeze({
    id: 'userid',
    create_at: 1,
    update_at: 1,
    delete_at: 1,
    username: 'username',
    password: 'password',
    auth_service: 'auth_service',
    email: 'aa@aa.aa',
    email_verified: true,
    nickname: 'nickname',
    first_name: 'first_name',
    last_name: 'last_name',
    position: 'position',
    roles: 'user',
    props: {},
    notify_props: {
        desktop: 'default',
        desktop_sound: 'true',
        email: 'true',
        mark_unread: 'all',
        push: 'default',
        push_status: 'ooo',
        comments: 'never',
        first_name: 'true',
        channel: 'true',
        mention_keys: '',
    },
    last_password_update: 1,
    last_picture_update: 1,
    locale: 'en',
    mfa_active: false,
    last_activity_at: 1,
    is_bot: false,
    bot_description: '',
    terms_of_service_id: '',
    terms_of_service_create_at: 1,
},
);

describe('ResultTable', () => {
    beforeEach(() => {
        props = {
            sent: true,
            rows: [],
        };
    });

    test('emails render as email', () => {
        props.rows = [{
            email: 'aa@aa.aa',
            reason: {id: 'some_reason', defaultMessage: 'some reason'},
        }];
        const {container} = renderWithContext(<ResultTable {...props}/>);

        // Email icon should be rendered - check for mail icon svg or class
        expect(container.querySelector('.mail-icon, svg')).toBeInTheDocument();
    });

    test('unsent invites render as unsent invites', () => {
        props.rows = [{
            text: '@incomplete_userna',
            reason: {id: 'incomplete_user', defaultMessage: 'This was not a complete user'},
        }];
        const {container} = renderWithContext(<ResultTable {...props}/>);

        // Alert icon should be rendered for unsent
        expect(container.querySelector('.alert-icon, svg')).toBeInTheDocument();
    });

    test('user invites render as users', () => {
        props.rows = [{
            user: defaultUser,
            reason: {id: 'success', defaultMessage: 'added successfully'},
        }];
        const {container} = renderWithContext(<ResultTable {...props}/>);

        // Avatar should be present (renders an img with class containing Avatar)
        expect(container.querySelector('.Avatar, img')).toBeInTheDocument();

        // Bot tag should not be present
        expect(screen.queryByText('BOT')).not.toBeInTheDocument();

        // Guest tag should not be present
        expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
    });

    test('bots render as bots', () => {
        props.rows = [{
            user: {
                ...defaultUser,
                is_bot: true,
            },
            reason: {id: 'success', defaultMessage: 'added successfully'},
        }];
        renderWithContext(<ResultTable {...props}/>);

        // Bot tag should be present
        expect(screen.getByText('BOT')).toBeInTheDocument();

        // Guest tag should not be present
        expect(screen.queryByText('GUEST')).not.toBeInTheDocument();
    });

    test('guests render as guests', () => {
        props.rows = [{
            user: {
                ...defaultUser,
                roles: 'system_guest',
            },
            reason: {id: 'success', defaultMessage: 'added successfully'},
        }];
        renderWithContext(<ResultTable {...props}/>);

        // Guest tag should be present
        expect(screen.getByText('GUEST')).toBeInTheDocument();

        // Bot tag should not be present
        expect(screen.queryByText('BOT')).not.toBeInTheDocument();
    });

    test('renders success banner when invites were sent', () => {
        props.sent = true;
        renderWithContext(<ResultTable {...props}/>);
        expect(screen.getByText('Successful Invites', {exact: false})).toBeInTheDocument();
    });

    test('renders not sent banner when invites were not sent', () => {
        props.sent = false;
        renderWithContext(<ResultTable {...props}/>);
        expect(screen.getByText('Invitations Not Sent', {exact: false})).toBeInTheDocument();
    });
});
